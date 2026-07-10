export const tabInfo = {
  qc: {
    title: "Quality Control Guide",
    content:
      "Welcome to the Quality Control tab.\n\n" +
      "• Overview: View the pre-filter distributions of raw cell metrics including total transcripts, unique genes, cell area, and nucleus signal.\n" +
      "• Thresholds: The red dashed lines indicate the exact cutoff thresholds used during the pipeline's QC filtering step to remove noise/artifacts.\n" +
      "• Slide Selection: Use the dropdown at the top to view aggregate metrics across all slides, or inspect an individual slide for batch effects.",
  },
  interactive: {
    title: "Interactive Explorer Guide",
    content:
      "Welcome to the Interactive Explorer tab.\n\n" +
      "• Spatial & UMAP: Explore the spatial distribution (tissue map) and transcriptomic UMAP side-by-side. Navigation is synced between both views.\n" +
      "• Coloring: Use the 'Color By' dropdown to color cells by Clusters, Annotations, or Metadata (like MuSpAn ROI or Disease Type).\n" +
      "• Gene Expression: Click any gene in the bottom-right list to override the cell colors and view a heatmap of that gene's expression.\n" +
      "• Pie Chart Filtering: Click a slice in the composition pie chart to isolate and highlight only that specific cell type in the plots above.",
  },
  multiplex: {
    title: "Multiplex Gene Overlay Guide",
    content:
      "Welcome to the Multiplex Overlay tab.\n\n" +
      "• Additive Blending: Visualize up to 5 spatial genes simultaneously using additive RGB blending (e.g., overlapping Red and Green creates Yellow).\n" +
      "• Thresholds: Adjust the 'Intensity Threshold' slider for each channel to remove low-expression background noise and highlight strong signals.\n" +
      "• Spatial Context: You must select a specific 'Sample' from the dropdown to view the tissue, preventing coordinates from multiple tissues from overlapping.",
  },
  stats: {
    title: "Spatial Statistics Guide",
    content:
      "Welcome to the Spatial Statistics tab.\n\n" +
      "• Neighborhoods: A heatmap showing which cell types are significantly colocalized (red) or avoiding each other (blue) based on Z-Scores.\n" +
      "• Distances (PCF): Pair Correlation Function graphs. Spikes above the red dashed line indicate the exact radius (in µm) where two cell types strongly interact.\n" +
      "• Morphology: Compare physical cell properties (like Area) across different clusters using violin plots.\n" +
      "• Autocorrelation: Identifies highly structured spatial patterns using Network Centrality and Moran's I statistics.\n" +
      "• Vitessce View: Use the right panel to map clusters or search for specific genes to see how they align with the spatial statistics.",
  },
  tf: {
    title: "Transcription Factor Analysis Guide",
    content:
      "Welcome to the Transcription Factor Analysis tab.\n\n" +
      "• Enrichment Heatmap: Displays Z-scaled TF activity scores per cell type. Click the buttons above the heatmap to filter the rows for specific cell types.\n" +
      "• Spatial/UMAP Explorer: Select a TF from the right-hand feature list to paint its predicted activity score onto the cells.\n" +
      "• Thresholding: Use the 'Min Color Threshold' slider at the top to hide low-activity background cells, allowing you to clearly see where the TF is most active.",
  },
  ccc: {
    title: "Cell-Cell Communication Guide",
    content:
      "Welcome to the Cell-Cell Communication tab.\n\n" +
      "• Chord Diagram: Visualizes directed ligand-receptor interactions. The thick base of the connecting ribbons represents the Sender (Ligand), pointing to the Receiver (Receptor).\n" +
      "• Filters: Isolate interactions happening within a specific Microenvironment, involving a specific Focal Cell Type, or specific Ligand-Receptor pairs.\n" +
      "• Visual Settings: Change the 'Color By' dropdown to easily trace outgoing signals (Sender colors), incoming signals (Receiver colors), or pair types.",
  },
  annotation: {
    title: "Cell Type Annotation Guide",
    content:
      "Welcome to the Cell Type Annotation tab.\n\n" +
      "• Sankey Diagram: Build a multi-step flow diagram to compare how cells map between different clustering resolutions or annotation algorithms.\n" +
      "• Hover Insights: Hover your mouse over any box (Cluster) to instantly see its total cell count in the right panel.\n" +
      "• Flow Tracking: When hovering over a cluster, the right panel will show exactly where its cells came from (Previous Step), and how it split apart (Next Step).",
  },
  deAnalysis: {
    title: "Cluster DE Analysis Guide",
    content:
      "Welcome to the Differential Expression Analysis tab.\n\n" +
      "• Target Cluster: Select an annotation grouping, then choose a target cluster to identify which marker genes define it compared to all other cells.\n" +
      "• Volcano Plot: Shows statistical significance vs. fold change. The top-right quadrant contains significantly upregulated marker genes.\n" +
      "• Marker Table: View the top defining genes for every cluster in the dataset.\n" +
      "• Violin Plot: Search for a specific gene to see its expression distribution across all clusters side-by-side.",
  },
  conditionsDe: {
    title: "Conditions DE Guide",
    content:
      "Welcome to the Conditions DE tab.\n\n" +
      "• Pairwise Comparison: Select a cell type and the two treatment/disease conditions you want to compare against each other.\n" +
      "• Volcano & Table: Instantly see the top upregulated and downregulated genes between the two conditions.\n" +
      "• Split Violins: Search for up to 3 genes in the bottom panels to compare their distributions side-by-side. Dotted lines indicate the mean expression for each condition.\n" +
      "• Hide Zeros: Check this box to drop cells with 0 expression, allowing you to compare shifts only in the cells actively expressing the target genes.",
  },
  spatialCcc: {
    title: "Spatial CCC (LIANA) Guide",
    content:
      "Welcome to the Spatial CCC tab.\n\n" +
      "• Interaction Mapping: Select a Ligand-Receptor pair (LR_) or Communication Signature (CCC_) from the dropdown to visualize its exact spatial footprint.\n" +
      "• Intensity Threshold: Adjust the 'Min Color Threshold' slider to filter out low-scoring background cells and highlight strong interactions.\n" +
      "• Single-Cell Resolution: Unlike macro-level cluster networks, these scores represent cell-cell communication happening at the micro-level across physical space."
  },
  causal: {
    title: "Condition Signaling (Causal) Guide",
    content:
      "Welcome to the Causal Network tab.\n\n" +
      "• This module maps how external signals (Ligand-Receptor) trigger intracellular protein cascades that regulate gene expression (Transcription Factors) under specific conditions (e.g., Disease vs Healthy).\n" +
      "• Condition-Altered Signals (Top-Left): Shows Ligand-Receptor pairs that are significantly up-regulated (Red) or down-regulated (Blue) between your conditions.\n" +
      "• Altered TF Activity (Bottom-Left): Shows which Transcription Factors are statistically shifted in the Receiver Cell.\n" +
      "• Causal Network (Right): An interactive force-directed graph mapping the known biological pathways linking the active Receptors (Green) through intermediate Kinases (Grey) to the Transcription Factors (Purple). Solid lines = Activation, Dashed lines = Inhibition."
  },
};
