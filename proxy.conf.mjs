// `ng serve` has no Netlify functions, so forward their calls to the deployed site.
// Local development then loads (and, as admin, saves) the same cloud data as the live app.
// Set ACMT_API_URL to use a different deploy.
const target = process.env.ACMT_API_URL || 'https://adityaclassic.netlify.app';

export default {
  '/.netlify/functions': {
    target,
    changeOrigin: true,
    secure: true,
  },
};
