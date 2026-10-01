import json
import logging
import os
import shutil
import traceback

import pandas as pd
import zarr

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class DataStore:
    def __init__(self) -> None:
        self.module_dir: str = os.getenv("MODULE_10_DIR", "/data")
        self.config_path: str = os.path.join(self.module_dir, "dataset_config.json")

        # Zarr & Data State
        self.zarr_path: str | None = None
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
        self._find_zarr_file()

        if not self.zarr_path or not os.path.exists(self.zarr_path):
            logger.warning(f"No Zarr file found in {self.module_dir}!")
            return

        logger.info(f"Connecting to Zarr store at {self.zarr_path}...")
        try:
            self.zarr_store = zarr.open(self.zarr_path, mode="r")
            self._load_dataframes()
            self._auto_detect_config()
            self._populate_metadata()
            self._handle_segmentations()

            logger.info(
                f"Loaded {len(self.obs_df)} cells and {len(self.var_df)} genes."
            )
            logger.info(
                f"Active Settings -> Slide: {self.slide_col} | Sample: {self.sample_col} | Spatial: {self.spatial_key}"
            )
        except Exception as e:
            logger.error(f"FATAL ERROR ON STARTUP: {e}")
            traceback.print_exc()

    def _load_config_json(self) -> None:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    config = json.load(f)
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
                logger.warning(f"Failed to parse dataset_config.json: {e}")
        else:
            logger.info(
                "No dataset_config.json found. Falling back to auto-detection..."
            )

    def _find_zarr_file(self) -> None:
        if self.zarr_filename_actual and os.path.exists(
            os.path.join(self.module_dir, self.zarr_filename_actual)
        ):
            self.zarr_path = os.path.join(self.module_dir, self.zarr_filename_actual)
            return

        if os.path.exists(self.module_dir):
            # Auto-detect pipeline output first, fallback to ANY zarr
            for f in os.listdir(self.module_dir):
                if f.endswith("_web.zarr") and "_tf_" not in f:
                    self.zarr_path = os.path.join(self.module_dir, f)
                    return

            for f in os.listdir(self.module_dir):
                if f.endswith(".zarr"):
                    self.zarr_path = os.path.join(self.module_dir, f)
                    return

    def _load_dataframes(self) -> None:
        if not self.zarr_store:
            return

        obs_group = self.zarr_store["obs"]
        obs_dict = {}
        for col in obs_group.keys():
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

        if not self.spatial_key and "obsm" in self.zarr_store:
            for target in ["global", "spatial", "X_spatial", "X_global"]:
                if target in self.zarr_store["obsm"]:
                    self.spatial_key = target
                    break

        if self.slide_col and self.slide_col in self.obs_df.columns:
            self.obs_df[self.slide_col] = (
                self.obs_df[self.slide_col]
                .astype(str)
                .apply(lambda x: f"Slide_{x}" if x.isdigit() else x)
            )

    def _populate_metadata(self) -> None:
        if self.obs_df is None or os.path.exists(self.config_path):
            return

        self.dynamic_annotations = []
        for c in self.obs_df.columns:
            if c.lower() in ["cell_id", "centroid_x", "centroid_y"]:
                continue
            if self.obs_df[c].nunique() < 100:
                self.extra_obs_sets.append(
                    {"name": str(c).replace("_", " ").title(), "path": f"obs/{c}"}
                )

    def _handle_segmentations(self) -> None:
        seg_dir = os.path.join(self.module_dir, "aux_data", "segmentations")
        user_provided_seg = os.path.join(self.module_dir, "segmentations.json")

        if os.path.exists(user_provided_seg):
            logger.info(
                "Lite Mode: User provided real polygons in 'segmentations.json'!"
            )
            os.makedirs(seg_dir, exist_ok=True)
            shutil.copy(user_provided_seg, os.path.join(seg_dir, "segmentations.json"))

            if self.obs_df is not None:
                if self.slide_col and self.slide_col in self.obs_df.columns:
                    for slide in self.obs_df[self.slide_col].dropna().unique():
                        shutil.copy(
                            user_provided_seg,
                            os.path.join(seg_dir, f"segmentations_Slide_{slide}.json"),
                        )
                if self.sample_col and self.sample_col in self.obs_df.columns:
                    for sample in self.obs_df[self.sample_col].dropna().unique():
                        shutil.copy(
                            user_provided_seg,
                            os.path.join(seg_dir, f"segmentations_{sample}.json"),
                        )
            self.has_segmentations = True

        elif os.path.exists(seg_dir) and any(
            f.endswith(".json") for f in os.listdir(seg_dir)
        ):
            logger.info("HPC Pipeline outputs detected. Using existing segmentations.")
            self.has_segmentations = True

        else:
            logger.info(
                "No segmentations found. Spatial view defaults to Scatterplot mode."
            )
            self.has_segmentations = False


# Global Singleton Instance
store = DataStore()
