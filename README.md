# Spatial-VisKit

Interactive Web based visualization tool that extends the general spatial transcriptomics pipeline.

## Prerequisites
- Download and install [Node.js](https://nodejs.org/).

## Setup Instructions
1. **Prepare Data**
- Place the web vis output folder (`10_WebVis.tar`) into the `./public` directory.
- Open a terminal in the `./public` folder and unzip it: 
     `tar -xf 10_WebVis.tar`
- Ensure your configuration file (`config.js`) is placed in the `./src` directory. 


2. **Install Dependencies**
- Open a terminal in the main project directory (where `package.json` is located).
- Run the following command to install all required modules:
     ```bash
     npm install
     ```

3. **Run SpatialVisKit**
- `cd public` and run 
    ```bash
    `npx http-server . --cors -p 9001` 
    ```
    
    on terminal. Look at what is printed out- look for the `Available on: ....` and paste that link starting with http in your config file on the top for `API_BASE_URL`. This is needed for Vitessce to work. 
- Start the visualization tool by running 
    ```bash
     npm run dev
    ``` 
    on terminal in main dir.
- Open the link provided in the terminal (usually `http://localhost:5173`) in your web browser
