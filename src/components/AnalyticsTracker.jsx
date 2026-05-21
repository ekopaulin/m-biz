import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ReactGA from 'react-ga4';

// Remplacez par votre vrai Measurement ID Google Analytics (ex: G-XXXXXXXXXX)
const MEASUREMENT_ID = 'G-XXXXXXXXXX'; 

let isInitialized = false;

const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized && MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
      ReactGA.initialize(MEASUREMENT_ID);
      isInitialized = true;
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
    }
  }, [location]);

  return null;
};

export default AnalyticsTracker;
