import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CreatorApp from './CreatorApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Simple path-based routing: /creator/* → CreatorApp, everything else → Team App
const isCreatorRoute = window.location.pathname.startsWith('/creator');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isCreatorRoute ? <CreatorApp /> : <App />}
  </React.StrictMode>
);