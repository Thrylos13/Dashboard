// const express = require("express");
// const responseTime = require('response-time');
// const client = require("prom-client");
// const { createLogger, transports } = require("winston");
// const LokiTransport = require("winston-loki");
// const options = {
//   transports: [
//     new LokiTransport({
//         labels: {
//             appName: 'express',
//         },
//       host: "http://127.0.0.1:3100",
//     }),
//   ],
// };
// const logger = createLogger(options);
// const { doSomeHeavyTask } = require("./util");

// const app = express();
// const PORT = process.env.PORT || 8000;

// const collectDefaultMetrics = client.collectDefaultMetrics;
// collectDefaultMetrics({ register: client.register });

// const reqResTime = new client.Histogram({
//     name: 'http_express_req_res_time',
//     help: 'This tells how much time is taken by req and res',
//     labelNames: ["method", "route", "status_code"],
//     buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000],
// });

// const totalReqCounter = new client.Counter({
//     name: 'total_req',
//     help: 'Tells total requests',
// });

// app.use(responseTime((req, res, time) => {
//     totalReqCounter.inc();
//     reqResTime
//         .labels({
//             method: req.method,
//             route: req.url,
//             status_code: res.statusCode,
//         })
//         .observe(time);
// }));

// app.get("/", (req, res) => {
//     logger.info("Req came on / router");
//     return res.json({ message: `Hello from Express Server` });
// });

// app.get("/slow", async (req, res) => {
//     try {
//         logger.info("Req came on /slow router");
//         const timeTaken = await doSomeHeavyTask();
//         return res.json({
//             status: "Success",
//             message: `Heavy Task completed in ${timeTaken}ms`,
//         });
//     } catch (error) {
//         logger.error(`${error.message}`);
//         return res
//             .status(500)
//             .json({ status: "Error", error: "Internal Server Error" });
//     }
// });

// app.get('/metrics', async (req, res) => {
//     res.setHeader('Content-Type', client.register.contentType);
//     const metrics = await client.register.metrics();
//     res.send(metrics);
// });

// app.listen(PORT, () =>
//     console.log(`Express Server Started at http://localhost:${PORT}`)
// );

const express = require("express");
const responseTime = require("response-time");
const client = require("prom-client");
const { createLogger } = require("winston");
const LokiTransport = require("winston-loki");
const os = require("os");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const http = require("http");

const PORT = process.env.PORT || 8000;

// Function to get external IPv4 address
function getExternalIPv4() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

const externalIP = getExternalIPv4();
const HOST = "0.0.0.0";
const targetAddress = `${externalIP}:${PORT}`;
console.log("Detected target address:", targetAddress);

// We keep the Prometheus config file is in the same directory as index.js.
const prometheusConfigPath = path.join(__dirname, "prometheus.yml");

function updatePrometheusYML() {
  let config;
  try {
    config = yaml.load(fs.readFileSync(prometheusConfigPath, "utf8"));
  } catch (err) {
    console.error("Error reading Prometheus config:", err);
    return;
  }
  
  if (!config.scrape_configs || !Array.isArray(config.scrape_configs)) {
    console.error("No scrape_configs found in Prometheus config.");
    return;
  }
  let jobConfig = config.scrape_configs.find(sc => sc.job_name === "prometheus");
  if (!jobConfig) {
    console.error("Job 'prometheus' not found in Prometheus config.");
    return;
  }
  // Ensure static_configs exists and is an array; initialize if empty.
  if (!jobConfig.static_configs || jobConfig.static_configs.length === 0) {
    jobConfig.static_configs = [{ targets: [] }];
  }
  let staticConfig = jobConfig.static_configs[0];
  if (!staticConfig.targets || !Array.isArray(staticConfig.targets)) {
    staticConfig.targets = [];
  }
  // Add this client's target if not already present
  if (!staticConfig.targets.includes(targetAddress)) {
    staticConfig.targets.push(targetAddress);
    console.log("Added target to Prometheus config:", targetAddress);
  } else {
    console.log("Target already exists in Prometheus config:", targetAddress);
  }
  
  try {
    fs.writeFileSync(prometheusConfigPath, yaml.dump(config));
    console.log("Prometheus config updated.");
  } catch (err) {
    console.error("Error writing Prometheus config:", err);
  }
  
  const reloadUrl = "http://localhost:9090/-/reload";
  const req = http.request(reloadUrl, { method: "POST" }, (res) => {
    console.log(`Prometheus reload triggered, status code: ${res.statusCode}`);
  });
  req.on("error", (err) => {
    console.error("Error triggering Prometheus reload:", err);
  });
  req.end();
}

updatePrometheusYML();

const options = {
  transports: [
    new LokiTransport({
      labels: {
        appName: 'express'
      },
      host: "http://127.0.0.1:3100",
    }),
  ],
};
const logger = createLogger(options);
const { doSomeHeavyTask } = require("./util");

const app = express();

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const reqResTime = new client.Histogram({
  name: 'http_express_req_res_time',
  help: 'This tells how much time is taken by req and res',
  labelNames: ["method", "route", "status_code"],
  buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000],
});

const totalReqCounter = new client.Counter({
  name: 'total_req',
  help: 'Tells total requests',
});

app.use(responseTime((req, res, time) => {
  totalReqCounter.inc();
  reqResTime
    .labels({
      method: req.method,
      route: req.url,
      status_code: res.statusCode,
    })
    .observe(time);
}));

app.get("/", (req, res) => {
    logger.info("Req came on / router");
    return res.json({ message: `Hello from Express Server` });
});

app.get("/slow", async (req, res) => {
    try {
        logger.info("Req came on /slow router");
        const timeTaken = await doSomeHeavyTask();
        return res.json({
            status: "Success",
            message: `Heavy Task completed in ${timeTaken}ms`,
        });
    } catch (error) {
        logger.error(`${error.message}`);
        return res
            .status(500)
            .json({ status: "Error", error: "Internal Server Error" });
    }
});

app.get('/metrics', async (req, res) => {
    res.setHeader('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.send(metrics);
});

app.listen(PORT, HOST, () =>
    console.log(`Express Server Started at http://${externalIP}:${PORT}`)
);
