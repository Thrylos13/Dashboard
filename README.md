
# Node.js Express Metrics with Auto‑Registered Prometheus Targets

This repository demonstrates a Node.js Express application that exposes Prometheus metrics and sends logs via Loki. Each client running this app automatically detects its external IP and updates a shared Prometheus configuration file so that its target (`externalIP:8000`) is added. This allows Grafana to display metrics from all clients—each client’s IP will appear in the Grafana instance dropdown (with an “All” option available).

---

## Features

- **Express Server:**  
  Exposes endpoints (`/`, `/slow`, `/metrics`) with simulated API calls.
  
- **Prometheus Metrics:**  
  Uses `prom-client` to collect default and custom metrics (e.g. request response time, total requests).

- **Loki Logging:**  
  Uses `winston` with the Loki transport to send logs to Loki.

- **Auto‑Registration of Targets:**  
  When a client starts, it:
  - Detects its external IP.
  - Constructs a target string as `externalIP:8000`.
  - Updates a shared `prometheus.yml` file (with an initially empty target list) to add its target.
  - Optionally triggers a reload of Prometheus so the new target is scraped immediately.

- **Grafana Dashboard:**  
  With Prometheus as the data source, the instance label is used to filter metrics. Grafana’s instance dropdown will list each client’s IP, allowing you to view individual systems or aggregated metrics.

---

## Prerequisites

- **Node.js** (v12+ recommended) and **npm**
- **Prometheus** configured with a YAML file (see below)
- **Docker** and **Docker Compose** (for running Grafana and Loki)
- A shared filesystem (or mounted volume) for the Prometheus configuration file, so all clients can update it

### NPM Packages

Install the required npm packages:

```bash
npm install winston winston-loki
npm install prom-client
npm install js-yaml
```

---

## File Structure

- **index.js** – The main Express server file with Prometheus metrics, Loki logging, and auto‑registration logic.
- **prometheus.yml** – The Prometheus configuration file with an initially empty target list.
- **util.js** – Utility functions (e.g. simulating a heavy task).
- (Optional) Docker Compose files for orchestrating Prometheus, Grafana, and Loki.

---

## Setup

### 1. Prometheus Configuration

Create a `prometheus.yml` file in the same directory as `index.js` with the following content:

```yaml
global:
  scrape_interval: 4s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: []  # Initially empty; clients will be added automatically
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        regex: '(.*):.*'
        replacement: '$1'
```

### 2. Docker Setup for Grafana and Loki

Start Grafana and Loki using the following commands:

```bash
docker run -d --name=loki -p 3100:3100 grafana/loki
docker run -d -p 3000:3000 --name=grafana grafana/grafana-oss
```

> **Note:**  
> Ensure that the directory containing `prometheus.yml` is mounted into the Prometheus container (if you are running Prometheus via Docker Compose) so that all clients update the same file.

---

## Running the Application

Each client will update the shared Prometheus configuration with its external IP (using port 8000). Instruct your clients to set up Grafana and Loki as described above, then run the Node.js app.

### On Unix/Linux/macOS

Open separate terminal windows for each client and run:

- **Client 1:**
  ```bash
  CLIENT_ID=client1 PORT=8000 node index.js
  ```

- **Client 2:**
  ```bash
  CLIENT_ID=client2 PORT=8000 node index.js
  ```

- **Client 3:**
  ```bash
  CLIENT_ID=client3 PORT=8000 node index.js
  ```

### On Windows

**Command Prompt:**
```cmd
set CLIENT_ID=client1
set PORT=8000
node index.js
```
Repeat in separate windows for each client.

**PowerShell:**
```powershell
$env:CLIENT_ID="client1"; $env:PORT="8000"; node index.js
```
Repeat for each client with different `CLIENT_ID` values.

---

## How It Works

1. **Auto‑Registration:**
   - On startup, the Node.js app determines its external IP using the host’s network interfaces.
   - It constructs a target string like `192.168.x.x:8000`.
   - The app then reads the shared `prometheus.yml` file, locates the target list for the "prometheus" job, and adds its target if it isn’t already present.
   - Finally, it sends a reload request to Prometheus (assumed to be running on `localhost:9090`) so the new target is immediately scraped.

2. **Prometheus and Grafana:**
   - Prometheus scrapes metrics from all targets registered in the shared configuration.
   - Grafana, when using a variable (e.g. based on the `instance` label), will show all individual client IPs in its dropdown, letting you filter metrics per system or view aggregated data.

---

## Troubleshooting

- **Environment Variables:**
  - Verify that the `CLIENT_ID` and `PORT` environment variables are set correctly (print them at the start of `index.js` if needed).

- **File Write Permissions:**
  - Ensure that the Node.js process has read/write permissions for `prometheus.yml` (especially important when running inside Docker).

- **Prometheus Reload:**
  - The code sends a POST request to `http://localhost:9090/-/reload`. If your Prometheus instance is running elsewhere, update this URL accordingly.

---
