import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

// fetch a resource and expose { data, error, loading, reload, setData }
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export function useSettings() {
  return useApi('/public/shop');
}
