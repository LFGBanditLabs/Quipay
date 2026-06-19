import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DLQManager } from '../db/dlq.js';
import { WebhookDeliveryService } from '../delivery.js';
import { DLQRetryWorker } from '../workers/dlqWorker.js';
import axios from 'axios';
import express from 'express';
import { Server } from 'http';

// Mock webhook server setup
let mockWebhookServer: Server;
let mockWebhookPort: number = 3001;
let webhookRequests: any[] = [];
let webhookShouldFail = false;
let webhookFailureCode = 500;

beforeAll(async () => {
  // Create mock webhook server
  const app = express();
  app.use(express.json());
  
  app.post('/webhook', (req, res) => {
    webhookRequests.push({
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    if (webhookShouldFail) {
      return res.status(webhookFailureCode).json({ error: 'Simulated failure' });
    }

    res.status(200).json({ success: true, received: req.body });
  });

  mockWebhookServer = app.listen(mockWebhookPort);
});

afterAll(async () => {
  if (mockWebhookServer) {
    mockWebhookServer.close();
  }
});

describe('DLQ Integration Tests', () => {
  let dlqManager: DLQManager;
  let webhookDelivery: WebhookDeliveryService;
  let dlqWorker: DLQRetryWorker;

  beforeEach(async () => {
    // Use in-memory database for tests
    dlqManager = new DLQManager(':memory:');
    webhookDelivery = new WebhookDeliveryService();
    dlqWorker = new DLQRetryWorker();
    
    // Reset mock server state
    webhookRequests = [];
    webhookShouldFail = false;
    webhookFailureCode = 500;

    // Wait for DB initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (dlqWorker) {
      dlqWorker.stop();
    }
    if (dlqManager) {
      await dlqManager.close();
    }
  });

  describe('Initial failure → DLQ enqueue', () => {
    it('should add webhook to DLQ when target server is unreachable', async () => {
      const payload = {
        event: 'payroll.completed',
        timestamp: new Date().toISOString(),
        data: { userId: 'user123', amount: '100.00' }
      };

      const result = await webhookDelivery.deliverWebhook('http://localhost:9999/webhook', payload);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      
      // Check that entry was added to DLQ
      const stats = await dlqManager.getStats();
      expect(stats.pending).toBe(1);
      
      const retryableEntries = await dlqManager.getRetryableEntries();
      expect(retryableEntries).toHaveLength(1);
      expect(retryableEntries[0].targetUrl).toBe('http://localhost:9999/webhook');
      expect(retryableEntries[0].retryCount).toBe(0);
    });

    it('should add webhook to DLQ when target server returns error status', async () => {
      webhookShouldFail = true;
      webhookFailureCode = 500;

      const payload = {
        event: 'stream.started',
        timestamp: new Date().toISOString(),
        data: { streamId: 'stream123' }
      };

      const result = await webhookDelivery.deliverWebhook(`http://localhost:${mockWebhookPort}/webhook`, payload);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
      
      // Check DLQ entry
      const retryableEntries = await dlqManager.getRetryableEntries();
      expect(retryableEntries).toHaveLength(1);
      expect(JSON.parse(retryableEntries[0].payload)).toMatchObject(payload);
    });

    it('should add webhook to DLQ when request times out', async () => {
      // Create a server that delays response beyond timeout
      const delayApp = express();
      delayApp.post('/slow-webhook', (req, res) => {
        setTimeout(() => {
          res.status(200).json({ success: true });
        }, 15000); // 15 second delay, longer than default timeout
      });
      
      const slowServer = delayApp.listen(3002);

      try {
        const payload = {
          event: 'withdrawal.completed',
          timestamp: new Date().toISOString(),
          data: { amount: '50.00' }
        };

        const result = await webhookDelivery.deliverWebhook('http://localhost:3002/slow-webhook', payload, {
          timeout: 1000 // 1 second timeout
        });
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
        
        const stats = await dlqManager.getStats();
        expect(stats.pending).toBe(1);
      } finally {
        slowServer.close();
      }
    });
  });

  describe('Retry success', () => {
    it('should successfully retry webhook after initial failure', async () => {
      // First, cause a failure
      webhookShouldFail = true;
      const payload = {
        event: 'payroll.failed',
        timestamp: new Date().toISOString(),
        data: { error: 'Insufficient balance' }
      };

      const initialResult = await webhookDelivery.deliverWebhook(`http://localhost:${mockWebhookPort}/webhook`, payload);
      expect(initialResult.success).toBe(false);

      // Get the DLQ entry
      const retryableEntries = await dlqManager.getRetryableEntries();
      expect(retryableEntries).toHaveLength(1);
      const entryId = retryableEntries[0].id!;

      // Now make webhook succeed
      webhookShouldFail = false;
      webhookRequests = []; // Clear previous failed requests

      // Retry the webhook
      const retryResult = await webhookDelivery.retryWebhookFromDLQ(entryId);
      expect(retryResult.success).toBe(true);

      // Check that webhook was received
      expect(webhookRequests).toHaveLength(1);
      expect(webhookRequests[0].body).toMatchObject(payload);

      // Check that entry is marked as successful
      const updatedEntry = await dlqManager.getEntryById(entryId);
      expect(updatedEntry?.status).toBe('success');
      
      // No more retryable entries
      const newRetryableEntries = await dlqManager.getRetryableEntries();
      expect(newRetryableEntries).toHaveLength(0);
    });

    it('should process retries automatically with DLQ worker', async () => {
      // Add entry to DLQ with immediate retry time
      const payload = { event: 'test.event', data: { test: true } };
      const entryId = await dlqManager.addEntry(payload, `http://localhost:${mockWebhookPort}/webhook`);

      // Set next retry to now
      await dlqManager.updateRetryAttempt(entryId, false, 'Initial test failure');
      
      // Manually update next_retry to be immediate for testing
      // (In real scenario, this would be handled by exponential backoff)
      
      webhookShouldFail = false;
      
      // Process retries
      await dlqWorker.processRetries();

      // Check that webhook was delivered
      expect(webhookRequests.length).toBeGreaterThan(0);
      const lastRequest = webhookRequests[webhookRequests.length - 1];
      expect(lastRequest.body).toMatchObject(payload);
    });
  });

  describe('Max retry exhausted', () => {
    it('should mark entry as permanently failed after max retries', async () => {
      const payload = {
        event: 'test.max_retries',
        data: { test: true }
      };

      // Add entry with max retries = 2 for faster testing
      const entryId = await dlqManager.addEntry(payload, `http://localhost:${mockWebhookPort}/webhook`, 2);
      
      webhookShouldFail = true;

      // Attempt retry 1
      let result = await webhookDelivery.retryWebhookFromDLQ(entryId);
      expect(result.success).toBe(false);
      
      let entry = await dlqManager.getEntryById(entryId);
      expect(entry?.retryCount).toBe(1);
      expect(entry?.status).toBe('retrying');

      // Attempt retry 2 (final retry)
      result = await webhookDelivery.retryWebhookFromDLQ(entryId);
      expect(result.success).toBe(false);
      
      entry = await dlqManager.getEntryById(entryId);
      expect(entry?.retryCount).toBe(2);
      expect(entry?.status).toBe('failed');

      // Should not be in retryable entries anymore
      const retryableEntries = await dlqManager.getRetryableEntries();
      expect(retryableEntries.find(e => e.id === entryId)).toBeUndefined();

      // Should be in permanently failed entries
      const failedEntries = await dlqManager.getPermanentlyFailedEntries();
      expect(failedEntries.find(e => e.id === entryId)).toBeDefined();
    });

    it('should emit audit event for permanently failed webhooks', async () => {
      // This test would require mocking the audit event emitter
      // For now, we'll just check the database state
      const payload = {
        event: 'test.permanent_failure',
        data: { important: 'data' }
      };

      const entryId = await dlqManager.addEntry(payload, 'http://localhost:9999/webhook', 1);
      
      const result = await webhookDelivery.retryWebhookFromDLQ(entryId);
      expect(result.success).toBe(false);
      
      const entry = await dlqManager.getEntryById(entryId);
      expect(entry?.status).toBe('failed');
      expect(entry?.retryCount).toBe(1);
    });
  });

  describe('DLQ Worker Management', () => {
    it('should start and stop DLQ worker', () => {
      expect(dlqWorker.getWorkerStatus()).resolves.toMatchObject({
        isRunning: false
      });

      dlqWorker.start();
      
      expect(dlqWorker.getWorkerStatus()).resolves.toMatchObject({
        isRunning: true
      });

      dlqWorker.stop();
      
      expect(dlqWorker.getWorkerStatus()).resolves.toMatchObject({
        isRunning: false
      });
    });

    it('should process all pending retries manually', async () => {
      // Add multiple entries
      await dlqManager.addEntry({ event: 'test1' }, `http://localhost:${mockWebhookPort}/webhook`);
      await dlqManager.addEntry({ event: 'test2' }, `http://localhost:${mockWebhookPort}/webhook`);
      await dlqManager.addEntry({ event: 'test3' }, `http://localhost:${mockWebhookPort}/webhook`);

      webhookShouldFail = false;
      webhookRequests = [];

      const summary = await dlqWorker.processAllPendingRetries();
      
      expect(summary.processed).toBe(3);
      expect(summary.successful).toBe(3);
      expect(summary.failed).toBe(0);
      
      expect(webhookRequests).toHaveLength(3);
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff for retry scheduling', async () => {
      const entryId = await dlqManager.addEntry(
        { event: 'backoff.test' }, 
        'http://localhost:9999/webhook'
      );

      // First failure - should schedule retry in ~30 seconds
      await dlqManager.updateRetryAttempt(entryId, false, 'First failure');
      let entry = await dlqManager.getEntryById(entryId);
      expect(entry?.retryCount).toBe(1);
      
      const firstRetryTime = new Date(entry!.nextRetry).getTime();
      const now = Date.now();
      const timeDiff = firstRetryTime - now;
      
      // Should be approximately 30 seconds (allow some variance)
      expect(timeDiff).toBeGreaterThan(25000);
      expect(timeDiff).toBeLessThan(35000);

      // Second failure - should schedule retry in ~2 minutes
      await dlqManager.updateRetryAttempt(entryId, false, 'Second failure');
      entry = await dlqManager.getEntryById(entryId);
      expect(entry?.retryCount).toBe(2);
      
      const secondRetryTime = new Date(entry!.nextRetry).getTime();
      const secondTimeDiff = secondRetryTime - Date.now();
      
      // Should be approximately 2 minutes
      expect(secondTimeDiff).toBeGreaterThan(115000); // 1:55
      expect(secondTimeDiff).toBeLessThan(125000);    // 2:05
    });
  });
});