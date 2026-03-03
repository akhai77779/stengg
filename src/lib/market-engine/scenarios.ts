import { Product } from '@/types/trading';
import { ProductScenario } from './types';

/**
 * Layer 1: Product Scenario
 * Each product gets its own scenario config that controls price behavior.
 * Scenarios can be customized per-product and persisted.
 */
export function createDefaultScenario(product: Product): ProductScenario {
  // Assign stronger trendStrength for clearer visual differentiation
  let trendStrength = 0.5;
  if (product.trend === 'bullish' && product.volatility <= 0.006) trendStrength = 0.8; // strong bullish
  if (product.trend === 'bullish' && product.volatility > 0.015) trendStrength = 0.7; // bullish + volatile
  if (product.trend === 'bearish') trendStrength = 0.75;
  if (product.trend === 'volatile') trendStrength = 0.9;
  if (product.trend === 'neutral') trendStrength = 0.1; // very flat sideway

  return {
    productId: product.id,
    trend: product.trend,
    volatility: product.volatility,
    basePrice: product.basePrice,
    trendStrength,
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
