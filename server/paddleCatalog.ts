/*
 * The live Paddle catalog: the public IDs of each Support Shop product, and the client-side token that opens checkouts.
 * Paddle designs all of these to be public (they end up in the page anyway). Settings with the same names
 * (PADDLE_PRODUCT_*, VITE_PADDLE_*) override them, for example sandbox IDs while testing. The API key and the webhook
 * secret are NOT here: they are Cloudflare secrets (PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET; docs/BILLING_SETUP.md).
 */
export const PADDLE_CATALOG = {
  clientToken: 'live_a312b944e551b59d7e46ecf0214',
  products: {
    supporter: 'pro_01m5s8tzgy7mpq7557askqqegn',
    noAds: 'pro_01m5s8sfarvqn27yn6jyn4f0na',
    bundleSupporter: 'pro_01m5s8swy1xbanm0j9rnrq2s9k',
    bundleVisionary: 'pro_01m5s8x9h3p43w0wz46v3cp9wc',
    bundleFounder: 'pro_01m5s8s0rkwhjn2anr8ghtf57b',
    bundleCustom: 'pro_01m5s8p75b9es3h0mcedanm9nc',
  },
  prices: {
    supporter: 'pri_01m5s932m0e3vneepggxjycvgp',
    noAds: 'pri_01m5s906e2khp2tnrsy7ebzwnw',
    bundleSupporter: 'pri_01m5s92dqmx1dfrxn9vyn55gvm',
    bundleVisionary: 'pri_01m5s9528vzp6s48sv1hj50rdb',
    bundleFounder: 'pri_01m5s8zf9rtravnqysbwsb42kx',
    bundleCustom: 'pri_01m5s8r2vn8zybwemjvwgv937w',
  },
} as const;
