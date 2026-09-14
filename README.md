# Spatial-VisKit

<img src="public/logo_hor.svg" alt="Logo" width="600">

An interactive, web-based visualization tool for exploring spatial transcriptomics (ST)datasets. Built to explore ST analysis results from **[this Xenium & CosMx pipeline](https://github.com/kitku15/scST-pipeline/)**.

Spatial-VisKit allows researchers to visually explore tissue maps, UMAPs, cell-cell communication, transcription factor activity, and clustering directly in their web browser—without needing to write a single line of code.

## 🛠️ Prerequisites

Because this app uses Docker, you **do not** need to install Python, Node.js, or any complex data science libraries.

1. Download and install **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**.
2. Make sure Docker Desktop is open and running in the background before proceeding.

## ⚙️ Set Up

### Step 1: Prepare Your Data

Spatial-VisKit needs a specific folder to read from. You will place your dataset folder into the `public/` directory of this app.

1. Locate your dataset folder. This might be an output from the HPC pipeline (e.g., `data_tyler`) or a standalone Zarr dataset (e.g., `data_kitam`).
2. Copy that entire folder into the `public/` folder of Spatial-VisKit.
3. Your folder structure should look like this:
   ```text
   Spatial-VisKit/
   ├── public/
   │   ├── my_data/
   │   │   ├── dataset_config.json
   │   │   ├── my_data.zarr
   │   │   ├── my_data.zarr
   │   │   └── aux_data
   ├── .env
   ├── docker-compose.yml
   └── ...
   ```

### Step 2: Configure the App

There are **two** configuration files you need to be aware of:

1. **`.env`**: Tells the app which dataset folder to load and what mode to run in.
2. **`dataset_config.json`**: placed inside your dataset folder and tells the app how to read your specific dataset.

#### A. `.env`

Open the file named `.env` (located in the main Spatial-VisKit folder) using any basic text editor (Notepad, VS Code.). Update the values to match the dataset you want to view.

```env
# 1. The exact name of your dataset folder inside the /public directory
ACTIVE_DATASET_FOLDER=my_data

# 2. What mode is the app in?
# "full" = Pipeline Output (Includes spatial stats, cell-cell comm, TF analysis)
# "lite" = Use-Your-Own-Data (Basic spatial, UMAP, and expression viewing)
VITE_APP_MODE=full

# 3. A title to be displayed in the app
VITE_PROJECT_TITLE="CosMx SMI: My Data XYZ"

# 4. Do not change this
VITE_API_BASE_URL=http://localhost:8000
```

#### B. `dataset_config.json`

Inside your specific dataset folder (e.g., `public/my_data/`), there must be a file named `dataset_config.json`. This tells the visualizer what columns and arrays to map.

Here is how you format this file depending on your app mode:

<details>
<summary><b>Click to view example for "FULL" Mode (HPC Pipeline Output)</b></summary>

**When to use:** Use this mode if your dataset was processed by the full HPC pipeline and includes advanced data like Transcription Factors, Spatial Stats, and Cell-Cell Communication files.

```json
{
  "zarr_filename": "my_data_web.zarr", # name of my zarr folder
  "tf_zarr_filename": "my_data_tf_web.zarr", # name of my zarr tf folder
  "spatial_key": "global", # key in obsm for spatial coordinates
  "slide_col": "slide_ID", # obs collumn for slide id
  "sample_col": "sample_id", # obs collumn for sample id
  "primary_annotation": "Final_Annotation", # cell type labels used for downstream analysis
  "dynamic_annotations": # leiden cell type clusters (change depending on n and r)
  [
    {"name": "Cell Clusters (Leiden)", "prefix": "leiden" }
  ],
  "extra_obs_sets": # additional categorical columns in "my_data_web.zarr" obs
  [
    { "name": "Disease Type", "path": "obs/DiseaseType" },
    { "name": "Treatment Response", "path": "obs/TreatmentResponse" },
    { "name": "FOV", "path": "obs/fov" },
    { "name": "Cell Lineage", "path": "obs/Broad_Lineage" },
    { "name": "Cell Type", "path": "obs/Final_Annotation" }
  ]
}
```

</details>

<details>
<summary><b>Click to view example for "LITE" Mode (Bring-Your-Own-Data)</b></summary>

**When to use:** Use this mode if you only have a standard `.zarr` file and just want to look at Spatial Coordinates, UMAPs, and basic gene expression mapping. It will disable the advanced HPC tabs.

```json
{
  "zarr_filename": "my_data.zarr", # name of my zarr folder
  "spatial_key": "global", # key in obsm for spatial coordinates
  "slide_col": "slide_id", # obs collumn for slide id
  "sample_col": "slide_id", # obs collumn for sample id
  "primary_annotation": "leiden_n30_r1.0", # ???

  "available_embeddings": # embeddings in your dataset in "my_data_web.zarr" obsm
  [
    { "name": "UMAP", "path": "obsm/X_umap" },
    { "name": "PCA", "path": "obsm/X_pca" }
  ],

  "dynamic_annotations": [], # leave blank???

  "extra_obs_sets": # additional categorical columns in "my_data_web.zarr" obs
  [
    { "name": "Disease Type", "path": "obs/DiseaseType" },
    { "name": "Cell Type", "path": "obs/CellType" }
  ]
}
```

</details>

---

### Step 3: Run the Application

Once your data is in the `public/` folder and your `.env` file is saved:

1. Open your computer's Terminal (Mac) or Command Prompt/PowerShell (Windows).
2. Navigate to the main Spatial-VisKit folder.
3. Run the following command:
   ```bash
   docker-compose up --build
   ```
4. Wait for the setup to finish. It will download the necessary containers and launch the tool.
5. Open your web browser and go to: **`http://localhost:5173`**

### To Stop the Application:

Go back to your terminal window where Docker is running and press `Ctrl + C`.

**⚠️ Important:** If you ever change the `ACTIVE_DATASET_FOLDER` in your `.env` file, you **must** stop the application (`Ctrl + C`) and restart it by typing `docker-compose up --build` again. This tells Docker to load the newly selected folder.

## ⭐ About

This application was developed as a part of a project for the MRes in Bioinformatics and Theoretical Systems Biology at Imperial College London. The work was supervised by Tamas Korcsmaros and Balazs Bohar.

- 😸 Author: Bunga Tiasyaira Hutasuhut (Syaii)
- 📩 Academic Email: bth22@ic.ac.uk
- 📮 Personal Email: bungatiasyaira@outlook.com
