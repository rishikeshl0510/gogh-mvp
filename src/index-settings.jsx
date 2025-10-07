import React from 'react';
import { createRoot } from 'react-dom/client';
import Settings from './components/Settings';
import './styles/settings.css';

const root = createRoot(document.getElementById('root'));
root.render(<Settings />);

