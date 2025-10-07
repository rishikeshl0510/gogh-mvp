import React from 'react';
import { createRoot } from 'react-dom/client';
import Graph from './components/Graph';
import './styles/graph.css';

const root = createRoot(document.getElementById('root'));
root.render(<Graph />);

