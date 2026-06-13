import React, { useState, useEffect, useMemo } from 'react';
import { Vitessce } from 'vitessce';

const baseUrl = "http://192.168.0.165:9001";

export default function VitessceViewer({ n, r }) {
  const [selectedSlide, setSelectedSlide] = useState("All");
  const [selectedSample, setSelectedSample] = useState("All");

  // State to hold auto-detected slides & samples
  const [hierarchy, setHierarchy] = useState({});
  const [availableSlides, setAvailableSlides] = useState(["All"]);
  const [availableSamples, setAvailableSamples] = useState(["All"]);

  // 1. Fetch auto-detected slide/sample metadata on load
  useEffect(() => {
    async function fetchMetadata() {
      try {
        // We will generate this JSON file in Python (see instructions below)
        const res = await fetch(`${baseUrl}/spatial_metadata.json`);
        if (!res.ok) throw new Error("Metadata JSON not found");
        const data = await res.json();
        
        setHierarchy(data);
        setAvailableSlides(["All", ...Object.keys(data)]);
      } catch (err) {
        console.warn("Could not load spatial_metadata.json. Are you sure you generated it?", err);
      }
    }
    fetchMetadata();
  }, []);

  // 2. Update Sample dropdown based on selected Slide
  useEffect(() => {
    if (Object.keys(hierarchy).length === 0) return;

    if (selectedSlide === "All") {
      // If "All" slides are selected, combine all samples from all slides
      const allSamples = Object.values(hierarchy).flat();
      setAvailableSamples(["All", ...allSamples]);
    } else {
      // If a specific slide is selected, only show its corresponding samples
      setAvailableSamples(["All", ...(hierarchy[selectedSlide] || [])]);
    }
  }, [selectedSlide, hierarchy]);

  // 3. Handle Slide Change (Reset sample when slide changes)
  const handleSlideChange = (e) => {
    setSelectedSlide(e.target.value);
    setSelectedSample("All"); // Force sample back to 'All' when changing slides
  };

  const config = useMemo(() => {
    let spatialEmbeddingKey = "obsm/global";
    
    // FIX: If a sample is selected, we ONLY need the sample name. 
    // We don't need to combine it with the slide name!
    if (selectedSample !== "All") {
      spatialEmbeddingKey = `obsm/global_${selectedSample}`;
    } else if (selectedSlide !== "All") {
      spatialEmbeddingKey = `obsm/global_${selectedSlide}`;
    }

    return {
      version: "1.0.15",
      name: "Tyler Spatial View",
      initStrategy: "auto",
      datasets: [
        {
          uid: "my-dataset",
          files: [
            {
              fileType: "anndata-cells.zarr",
              url: `${baseUrl}/adata_tyler.zarr/`,
              options: {
                mappings: {
                  UMAP: {
                    key: `obsm/X_umap_n${n}`,
                    dims: [0, 1]
                  },
                  spatial_view: {
                    key: spatialEmbeddingKey,
                    dims: [0, 1]
                  }
                }
              }
            },
            {
              fileType: "obsSets.anndata.zarr",
              url: `${baseUrl}/adata_tyler.zarr/`,
              options: [
                { name: "Cell Clusters", path: `obs/leiden_n${n}_r${r}` },
                { name: "CellTypist (Majority Voting)", path: `obs/CellTypist_majorityvoting_leiden_n${n}_r${r}` },
                { name: "FOV", path: `obs/fov` },
                { name: "Disease Type", path: `obs/DiseaseType` },
                { name: "Treatment Response", path: `obs/TreatmentResponse` }
              ]
            },
            {
              fileType: "obsFeatureMatrix.anndata.zarr",
              url: `${baseUrl}/adata_tyler.zarr/`,
              options: { path: "X" }
            }
          ]
        }
      ],
      coordinationSpace: {
        embeddingType: { ET1: "UMAP", ET2: "spatial_view" },
        embeddingObsRadiusMode: { RM1: "manual" },
        embeddingObsRadius: { R1: 2.0, R2: 2.0 }
      },
      layout: [
        {
          component: "scatterplot",
          coordinationScopes: { embeddingType: "ET1", embeddingObsRadiusMode: "RM1", embeddingObsRadius: "R1" },
          x: 0, y: 0, w: 4, h: 12
        },
        {
          component: "scatterplot",
          coordinationScopes: { embeddingType: "ET2", embeddingObsRadiusMode: "RM1", embeddingObsRadius: "R2" },
          x: 4, y: 0, w: 4, h: 12
        },
        {
          component: "obsSets",
          x: 8, y: 0, w: 2, h: 12
        },
        {
          component: "featureList",
          x: 10, y: 0, w: 2, h: 12
        }
      ]
    };
  }, [n, r, selectedSlide, selectedSample]);

  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="bg-gray-200 border-b border-gray-400 px-4 py-2 flex gap-6 items-center z-10">
        <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">Spatial Filters:</span>
        
        <label className="text-sm font-semibold flex items-center gap-2">
          Slide:
          <select 
            className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none"
            value={selectedSlide} 
            onChange={handleSlideChange}
          >
            {availableSlides.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="text-sm font-semibold flex items-center gap-2">
          Sample:
          <select 
            className="border border-gray-400 rounded px-2 py-1 bg-white font-normal outline-none disabled:bg-gray-100 disabled:text-gray-400"
            value={selectedSample} 
            onChange={(e) => setSelectedSample(e.target.value)}
            disabled={availableSamples.length <= 1} // Disable if no samples detected
          >
            {availableSamples.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <span className="text-xs text-gray-500 italic ml-auto">
          * UMAP stays unaffected. Cluster coloring is preserved.
        </span>
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <Vitessce
          key={`vitessce-${n}-${r}`}
          config={config}
          theme="light"
        />
      </div>
    </div>
  );
}