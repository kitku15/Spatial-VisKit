import { useState, useEffect, useMemo } from "react";
import { APP_MODE, API_BASE_URL } from "../config/config";

export function useMetadata() {
  const [datasetConfig, setDatasetConfig] = useState(null);
  const [allColumns, setAllColumns] = useState([]);
  const [clusterMap, setClusterMap] = useState({});
  const [allEmbeddings, setAllEmbeddings] = useState([]);

  const [availableN, setAvailableN] = useState([]);
  const [selectedN, setSelectedN] = useState("");
  const [appliedN, setAppliedN] = useState("");

  const [selectedR, setSelectedR] = useState("");
  const [appliedR, setAppliedR] = useState("");

  const [selectedEmbedding, setSelectedEmbedding] = useState("");
  const [appliedEmbedding, setAppliedEmbedding] = useState("");

  useEffect(() => {
    async function fetchZarrMetadata() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/metadata`);
        const data = await response.json();

        setDatasetConfig(data);
        const columns = data.obs_columns || [];
        const obsmKeys = data.obsm_keys || [];
        setAllColumns(columns);

        let nList = [];
        let eList = [];
        const cMap = {};

        if (APP_MODE === "full") {
          columns.forEach((col) => {
            const match = col.match(/_n(\d+)_r([\d.]+)/);
            if (match) {
              const nVal = match[1];
              const rVal = match[2];
              if (!cMap[nVal]) cMap[nVal] = new Set();
              cMap[nVal].add(rVal);
            }
          });
          nList = Object.keys(cMap).sort((a, b) => Number(a) - Number(b));

          const actualEmbeddings = obsmKeys.filter(
            (k) => typeof k === "string" && !k.startsWith("_"),
          );
          eList = actualEmbeddings.length > 0 ? actualEmbeddings : ["X_umap"];
        } else {
          nList = [];
          const configEmbeddings =
            data.available_embeddings && data.available_embeddings.length > 0
              ? data.available_embeddings
              : [{ name: "UMAP", path: "obsm/X_umap" }];
          eList = configEmbeddings.map((e) => e.path.replace("obsm/", ""));
        }

        setClusterMap(cMap);
        setAllEmbeddings(eList);
        setAvailableN(nList);

        const initialN = nList.length > 0 ? nList[0] : "";
        setSelectedN(initialN);
        setAppliedN(initialN);

        const initialRs = Array.from(cMap[initialN] || []).sort(
          (a, b) => Number(a) - Number(b),
        );
        const initialR = initialRs.length > 0 ? String(initialRs[0]) : "";
        setSelectedR(initialR);
        setAppliedR(initialR);

        const initialEmbeddings = eList.filter((val) => {
          const match = val.match(/_n(\d+)/);
          return !match || match[1] === String(initialN);
        });
        const initialEmbedding =
          initialEmbeddings.length > 0
            ? initialEmbeddings[0]
            : eList[0] || "none";
        setSelectedEmbedding(initialEmbedding);
        setAppliedEmbedding(initialEmbedding);
      } catch (error) {
        console.error("Failed to fetch API metadata.", error);
      }
    }
    fetchZarrMetadata();
  }, []);

  const availableR = useMemo(() => {
    if (APP_MODE !== "full" || Object.keys(clusterMap).length === 0) return [];
    return Array.from(clusterMap[selectedN] || []).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [selectedN, clusterMap]);

  const availableEmbeddings = useMemo(() => {
    if (APP_MODE !== "full" || allEmbeddings.length === 0) return allEmbeddings;
    return allEmbeddings.filter((val) => {
      const match = val.match(/_n(\d+)/);
      return !match || match[1] === String(selectedN);
    });
  }, [selectedN, allEmbeddings]);

  const handleSelectN = (newN) => {
    setSelectedN(newN);
    if (APP_MODE !== "full") return;

    const validRs = Array.from(clusterMap[newN] || []).sort(
      (a, b) => Number(a) - Number(b),
    );
    if (
      validRs.length > 0 &&
      !validRs.map(String).includes(String(selectedR))
    ) {
      setSelectedR(String(validRs[0]));
    }

    const validEmbeddings = allEmbeddings.filter((val) => {
      const match = val.match(/_n(\d+)/);
      return !match || match[1] === String(newN);
    });
    if (
      validEmbeddings.length > 0 &&
      !validEmbeddings.includes(selectedEmbedding)
    ) {
      setSelectedEmbedding(validEmbeddings[0]);
    }
  };

  return {
    datasetConfig,
    allColumns,
    availableN,
    availableR,
    availableEmbeddings,
    selectedN,
    appliedN,
    selectedR,
    appliedR,
    selectedEmbedding,
    appliedEmbedding,
    handleSelectN,
    setSelectedR,
    setSelectedEmbedding,
    setAppliedN,
    setAppliedR,
    setAppliedEmbedding,
  };
}
