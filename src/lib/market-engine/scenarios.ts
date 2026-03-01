import { Product } from '@/types/trading';
import { ProductScenario } from './types';

/**
 * Layer 1: Product Scenario
 * Each product gets its own scenario config that controls price behavior.
 * Scenarios can be customized per-product and persisted.
 */
export function createDefaultScenario(product: Product): ProductScenario {
  return {
    productId: product.id,
    trend: product.trend,
    volatility: product.volatility,
    basePrice: product.basePrice,
    trendStrength: 0.5,
  };
}

export function createScenariosFromProducts(products: Product[]): Record<string, ProductScenario> {
  const scenarios: Record<string, ProductScenario> = {};
  products.forEach(p => {
    scenarios[p.id] = createDefaultScenario(p);
  });
  return scenarios;
}

/** Get trend bias from scenario */
export function getTrendBias(scenario: ProductScenario): number {
  const strength = scenario.trendStrength ?? 0.5;
  switch (scenario.trend) {
    case 'bullish': return 0.6 * strength;
    case 'bearish': return -0.6 * strength;
    case 'volatile': return (Math.random() - 0.5) * 2 * strength;
    default: return 0;
  }
}
