module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...(config.android || {}),
      ...((config.android && config.android.config) || googleMapsApiKey
        ? {
            config: {
              ...((config.android && config.android.config) || {}),
              ...(googleMapsApiKey
                ? {
                    googleMaps: {
                      apiKey: googleMapsApiKey,
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
  };
};
