import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { metricsManager } from './metrics';
import { webhookRouter } from './webhooks';
import { slackRouter } from './slack';
import { discordRouter } from './discord';
import { startStellarListener } from './stellarListener';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/webhooks', webhookRouter);
app.use('/slack', slackRouter);
// Note: discordRouter utilizes native express payloads natively bypassing body buffers mapping local examples
app.use('/discord', discordRouter);

// Start time for uptime calculation
const startTime = Date.now();

/**
 * @api {get} /health Health check endpoint
 * @apiDescription Returns the status and heartbeat of the automation engine.
 */
app.get('/health', (req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    res.json({
        status: 'ok',
        uptime: `${uptime}s`,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.0.1',
        service: 'quipay-automation-engine'
    });
});

/**
 * @api {get} /metrics Metrics endpoint
 * @apiDescription Exports data on processed transactions, success rates, and latency in Prometheus format.
 */
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', metricsManager.register.contentType);
        res.end(await metricsManager.register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});

// Mock endpoint to simulate transaction processing for testing metrics
app.post('/test/simulate-tx', (req, res) => {
    const { status, latency } = req.body;
    metricsManager.trackTransaction(status || 'success', latency || Math.random() * 2);
    res.json({ message: 'Transaction tracked' });
});

app.listen(port, () => {
    console.log(`🚀 Quipay Automation Engine Status API listening at http://localhost:${port}`);
    startStellarListener();
});
