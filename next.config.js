/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16: typedRoutes moved out of `experimental`.
  typedRoutes: false,
  // Opt into Next 16 Cache Components so `'use cache'` + cacheTag/cacheLife
  // become available. With this on, route segments still default to dynamic;
  // any function or file marked `'use cache'` is cached at the function level
  // and invalidated by updateTag()/revalidateTag().
  cacheComponents: true,
};
module.exports = nextConfig;
