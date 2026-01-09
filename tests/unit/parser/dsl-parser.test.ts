import { describe, it, expect } from 'vitest';
import { parseDSL } from '../../../src/parser/dsl-parser.js';

describe('DSL Parser', () => {
  describe('node parsing', () => {
    it('should parse rectangle nodes', () => {
      const result = parseDSL('[Process Step]');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('rectangle');
      expect(result.nodes[0].label).toBe('Process Step');
    });

    it('should parse diamond nodes', () => {
      const result = parseDSL('{Decision?}');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('diamond');
      expect(result.nodes[0].label).toBe('Decision?');
    });

    it('should parse ellipse nodes', () => {
      const result = parseDSL('(Start)');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('ellipse');
      expect(result.nodes[0].label).toBe('Start');
    });

    it('should parse database nodes', () => {
      const result = parseDSL('[[Database]]');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('database');
      expect(result.nodes[0].label).toBe('Database');
    });
  });

  describe('connection parsing', () => {
    it('should parse simple connections', () => {
      const result = parseDSL('[A] -> [B]');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe(result.nodes[0].id);
      expect(result.edges[0].target).toBe(result.nodes[1].id);
    });

    it('should parse labeled connections', () => {
      const result = parseDSL('[A] -> "yes" -> [B]');
      expect(result.edges[0].label).toBe('yes');
    });

    it('should parse dashed connections', () => {
      const result = parseDSL('[A] --> [B]');
      expect(result.edges[0].style?.strokeStyle).toBe('dashed');
    });

    it('should parse chains of connections', () => {
      const result = parseDSL('[A] -> [B] -> [C]');
      expect(result.nodes).toHaveLength(3);
      expect(result.edges).toHaveLength(2);
    });
  });

  describe('directive parsing', () => {
    it('should parse direction directive', () => {
      const result = parseDSL('@direction LR\n[A] -> [B]');
      expect(result.options.direction).toBe('LR');
    });

    it('should parse spacing directive', () => {
      const result = parseDSL('@spacing 100\n[A] -> [B]');
      expect(result.options.nodeSpacing).toBe(100);
    });
  });

  describe('complex flowcharts', () => {
    it('should parse a decision tree', () => {
      const dsl = `
        (Start) -> [Enter Credentials] -> {Valid?}
        {Valid?} -> "yes" -> [Dashboard] -> (End)
        {Valid?} -> "no" -> [Show Error] -> [Enter Credentials]
      `;
      const result = parseDSL(dsl);

      expect(result.nodes.length).toBeGreaterThanOrEqual(5);
      expect(result.edges.length).toBeGreaterThanOrEqual(5);
    });

    it('should deduplicate nodes by label and type', () => {
      const result = parseDSL('[A] -> [B]\n[B] -> [C]');
      const bNodes = result.nodes.filter((n) => n.label === 'B');
      expect(bNodes).toHaveLength(1);
    });
  });
});
