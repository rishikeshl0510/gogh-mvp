import React from 'react';
import { createRoot } from 'react-dom/client';
import Mode from './components/Mode';
import './styles/mode.css';

const root = createRoot(document.getElementById('root'));
root.render(<Mode />);

