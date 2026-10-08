import logging
import traceback
import requests

import pandas as pd
import zarr
import fsspec

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class DataStore:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.config_url = f"{self.base_url}/dataset_config.json"

        # Zarr & Data State
        self.zarr_url: str | None = None
        self.zarr_store: zarr.Group | None = None
        self.obs_df: pd.DataFrame | None = None
        self.var_df: pd.DataFrame | None = None

        # Configuration Settings
        self.slide_col: str | None = None
        self.sample_col: str | None = None
        self.spatial_key: str | None = None
        self.vitessce_dot_size: int = 2
        self.primary_annotation: str = "Final_Annotation"
        self.dynamic_annotations: list[dict[str, str]] = [
            {"name": "Cell Clusters (Leiden)", "prefix": "leiden"}
        ]
        self.extra_obs_sets: list[dict[str, str]] = []
        self.tf_zarr_filename: str = ""
        self.zarr_filename_actual: str = ""
        self.available_embeddings: list[dict[str, str]] = []
        self.has_segmentations: bool = False

    def load_data(self) -> None:
        self._load_config_json()

        if not self.zarr_filename_actual:
            logger.warning("No zarr_filename found in remote dataset_config.json!")
            return

        self.zarr_url = f"{self.base_url}/{self.zarr_filename_actual}"
        logger.info(f"Connecting to remote Zarr store at {self.zarr_url}...")

        try:
            # Create an HTTP mapper so Zarr can stream chunks from Cloudflare
            mapper = fsspec.get_mapper(self.zarr_url)
            self.zarr_store = zarr.open(mapper, mode="r")

            self._load_dataframes()
            self._auto_detect_config()
            self._populate_metadata()

            self.has_segmentations = False
        except Exception as e:
            logger.error(f"FATAL ERROR ON STARTUP: {e}")
            traceback.print_exc()
            # Reset states so it knows it failed
            self.zarr_store = None
            self.obs_df = None
            self.var_df = None

    def _load_config_json(self) -> None:
        try:
            resp = requests.get(self.config_url)
            if resp.status_code == 200:
                config = resp.json()
                self.zarr_filename_actual = config.get("zarr_filename", "")
                self.tf_zarr_filename = config.get("tf_zarr_filename", "")
                self.slide_col = config.get("slide_col")
                self.sample_col = config.get("sample_col")
                self.spatial_key = config.get("spatial_key")
                self.vitessce_dot_size = config.get("vitessce_dot_size", 2)
                self.primary_annotation = config.get(
                    "primary_annotation", "Final_Annotation"
                )
                self.dynamic_annotations = config.get(
                    "dynamic_annotations",
                    [{"name": "Cell Clusters (Leiden)", "prefix": "leiden"}],
                )
                self.extra_obs_sets = config.get("extra_obs_sets", [])
                self.available_embeddings = config.get(
                    "available_embeddings",
                    [{"name": "UMAP", "path": "obsm/X_umap"}],
                )
        except Exception as e:
            logger.warning(f"Failed to parse remote dataset_config.json: {e}")

    def _load_dataframes(self) -> None:
        # FIX 1: 'is None' prevents HTTP directory listing
        if self.zarr_store is None:
            return

        try:
            logger.info("Fetching /obs directly to avoid listing...")
            obs_group = self.zarr_store["obs"]
            obs_dict = {}

            # Read column-order from .zattrs to prevent directory listing over HTTP
            cols = obs_group.attrs.get("column-order", [])
            if not cols:
                try:
                    # Fallback: this MIGHT trigger directory listing, but we try/except it
                    cols = [k for k in obs_group.keys() if not k.startswith("_")]
                except Exception as e:
                    logger.warning(
                        f"Could not list obs columns (Cloudflare blocking directory listing): {e}"
                    )
                    cols = []

            for col in cols:
                if col.startswith("_"):
                    continue
                try:
                    item = obs_group[col]
                    if isinstance(item, zarr.Array):
                        obs_dict[col] = item[:]
                    elif isinstance(item, zarr.Group):
                        if "codes" in item and "categories" in item:
                            codes = item["codes"][:]
                            cats = [
                                c.decode("utf-8") if isinstance(c, bytes) else str(c)
                                for c in item["categories"][:]
                            ]
                            obs_dict[col] = [
                                cats[c] if c >= 0 else "Unknown" for c in codes
                            ]
                except Exception as col_err:
                    logger.warning(f"Failed to parse column '{col}': {col_err}")

            self.obs_df = pd.DataFrame(obs_dict)
            obs_index_name = obs_group.attrs.get("_index", "_index")
            if obs_index_name in obs_group:
                idx_vals = obs_group[obs_index_name][:]
                if len(idx_vals) > 0 and isinstance(idx_vals[0], bytes):
                    idx_vals = [x.decode("utf-8") for x in idx_vals]
                self.obs_df.index = list(idx_vals)
            elif "cell_id" in self.obs_df.columns:
                self.obs_df.index = self.obs_df["cell_id"].astype(str)

            var_group = self.zarr_store["var"]
            index_name = var_group.attrs.get("_index", "_index")
            self.var_df = pd.DataFrame(index=var_group[index_name][:])
        except Exception as e:
            logger.error(f"Error building dataframes: {e}")
            raise

    def _auto_detect_config(self) -> None:
        if self.obs_df is None or self.zarr_store is None:
            return

        obs_cols_lower = {c.lower(): c for c in self.obs_df.columns}

        if not self.slide_col:
            for target in ["slide_id", "batch", "slide id", "slide"]:
                if target in obs_cols_lower:
                    self.slide_col = obs_cols_lower[target]
                    break

        if not self.sample_col:
            for target in ["sample_id", "sample", "sample id", "library_id", "fov"]:
                if target in obs_cols_lower:
                    self.sample_col = obs_cols_lower[target]
                    break

        # FIX 2: Bypassing "in" keyword because it triggers directory listing over HTTP
        if not self.spatial_key:
            try:
                obsm_group = self.zarr_store["obsm"]
                for target in ["global", "spatial", "X_spatial", "X_global"]:
                    try:
                        # Attempt to access the key directly to avoid listing
                        _ = obsm_group[target]
                        self.spatial_key = target
                        logger.info(f"Auto-detected spatial key: {target}")
                        break
                    except KeyError:
                        pass
            except KeyError:
                pass  # No obsm group found

        if self.slide_col and self.slide_col in self.obs_df.columns:
            self.obs_df[self.slide_col] = (
                self.obs_df[self.slide_col]
                .astype(str)
                .apply(lambda x: f"Slide_{x}" if x.isdigit() else x)
            )

    def _populate_metadata(self) -> None:
        # If we successfully loaded extra_obs_sets from the cloud config, don't overwrite them
        if self.obs_df is None or len(self.extra_obs_sets) > 0:
            return

        self.dynamic_annotations = []
        for c in self.obs_df.columns:
            if c.lower() in ["cell_id", "centroid_x", "centroid_y"]:
                continue
            if self.obs_df[c].nunique() < 100:
                self.extra_obs_sets.append(
                    {"name": str(c).replace("_", " ").title(), "path": f"obs/{c}"}
                )


# Store Manager for BYOD Multi-tenant architecture
class StoreManager:
    def __init__(self):
        self.stores = {}

    def get_store(self, data_url: str) -> DataStore:
        if not data_url:
            raise ValueError("No data_url provided.")

        data_url = data_url.rstrip("/")
        if data_url not in self.stores:
            logger.info(f"Initializing new dataset from {data_url}")
            new_store = DataStore(data_url)
            new_store.load_data()

            # ONLY cache it if it successfully loaded data!
            if new_store.obs_df is not None:
                self.stores[data_url] = new_store
            else:
                logger.error("Dataset failed to load properly. Skipping cache.")
                return new_store

        return self.stores[data_url]


store_manager = StoreManager()
