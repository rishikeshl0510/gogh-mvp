const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  {
    target: 'electron-renderer',
    entry: './src/index-command.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'command.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'command.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  },
  {
    target: 'electron-renderer',
    entry: './src/index-panel.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'panel.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'panel.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  },
  {
    target: 'electron-renderer',
    entry: './src/index-graph.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'graph.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'graph.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  },
  {
    target: 'electron-renderer',
    entry: './src/index-sidebar.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'sidebar.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'sidebar.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  },
  {
    target: 'electron-renderer',
    entry: './src/index-mode.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'mode.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'mode.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  },
  {
    target: 'electron-renderer',
    entry: './src/index-settings.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'settings.bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './build-template.html',
        filename: 'settings.html'
      })
    ],
    resolve: {
      extensions: ['.js', '.jsx']
    }
  }
];

