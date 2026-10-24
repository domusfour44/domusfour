// Exclude the old illustrated sample products, including records already in Supabase.
const sampleIds = new Set(['gennaro-patrono', 'gennaro-ampolla', 'diego-capitano', 'diego-divisa-bianca', 'pulcinella', 'cornetto']);
export function isCatalogProduct(product) {
  return !sampleIds.has(product.id) && typeof product.category === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,79}$/.test(product.category) && !['maschere', 'fortuna'].includes(product.category) &&
    typeof product.image === 'string' && !/\.svg(?:[?#]|$)/i.test(product.image);
}
