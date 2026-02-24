/**
 * Redaction Engine - Sensitive Data Protection
 * 
 * Automatically redacts sensitive information from log entries including
 * private keys, seed phrases, authentication tokens, and custom fields.
 */

import { RedactionConfig } from './types';

/**
 * RedactionEngine class - Handles sensitive data redaction
 */
export class RedactionEngine {
  private patterns: Map<string, RegExp>;
  private sensitiveFields: Set<string>;

  constructor(config: RedactionConfig) {
    this.patterns = new Map();
    this.sensitiveFields = new Set();

    // Initialize default patterns
    this.initializeDefaultPatterns();

    // Add custom sensitive fields (case-insensitive)
    config.customFields.forEach(field => {
      this.sensitiveFields.add(field.toLowerCase());
    });
  }

  /**
   * Initialize default redaction patterns
   */
  private initializeDefaultPatterns(): void {
    // Stellar private keys: S followed by 55 alphanumeric characters
    this.patterns.set('stellar_private_key', /S[A-Z0-9]{55}/g);
    
    // Stellar public keys (for reference, not redacted): G followed by 55 alphanumeric characters
    this.patterns.set('stellar_public_key', /G[A-Z0-9]{55}/g);
    
    // JWT tokens: eyJ... format
    this.patterns.set('jwt_token', /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g);
    
    // Generic bearer tokens
    this.patterns.set('bearer_token', /Bearer\s+[A-Za-z0-9-_]+/gi);

    // Default sensitive field names
    const defaultSensitiveFields = [
      'password',
      'secret',
      'privatekey',
      'private_key',
      'seedphrase',
      'seed_phrase',
      'mnemonic',
      'token',
      'apikey',
      'api_key',
      'auth',
      'authorization',
    ];

    defaultSensitiveFields.forEach(field => {
      this.sensitiveFields.add(field.toLowerCase());
    });
  }

  /**
   * Redact sensitive data from any value
   */
  redact(data: unknown): unknown {
    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redact(item));
    }

    if (typeof data === 'object' && data !== null) {
      return this.redactObject(data as Record<string, unknown>);
    }

    return data;
  }

  /**
   * Redact sensitive patterns from strings
   */
  private redactString(value: string): string {
    let redacted = value;

    // Check if this is a seed phrase (12 or 24 words)
    if (this.isSeedPhrase(value)) {
      return '[REDACTED]';
    }

    // Apply all pattern-based redactions
    // Redact private keys but preserve public keys
    redacted = redacted.replace(/S[A-Z0-9]{55}/g, '[REDACTED]');
    
    // Redact JWT tokens
    redacted = redacted.replace(
      /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
      '[REDACTED]'
    );
    
    // Redact bearer tokens
    redacted = redacted.replace(/Bearer\s+[A-Za-z0-9-_]+/gi, 'Bearer [REDACTED]');

    return redacted;
  }

  /**
   * Redact sensitive fields from objects
   */
  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if field name is sensitive
      if (this.sensitiveFields.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        // Recursively redact the value
        redacted[key] = this.redact(value);
      }
    }

    return redacted;
  }

  /**
   * Check if a string is a seed phrase (12 or 24 words)
   */
  private isSeedPhrase(value: string): boolean {
    const trimmed = value.trim();
    const words = trimmed.split(/\s+/);
    
    // Must be exactly 12 or 24 words
    if (words.length !== 12 && words.length !== 24) {
      return false;
    }

    // All words should be lowercase alphabetic
    return words.every(word => /^[a-z]+$/.test(word));
  }

  /**
   * Add a custom field to redact
   */
  addSensitiveField(fieldName: string): void {
    this.sensitiveFields.add(fieldName.toLowerCase());
  }

  /**
   * Add a custom pattern to redact
   */
  addPattern(name: string, pattern: RegExp): void {
    this.patterns.set(name, pattern);
  }
}
