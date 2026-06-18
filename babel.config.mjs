export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['> 1%', 'last 3 versions', 'not dead']
        },
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { version: '2023-05', decoratorsBeforeExport: false }],
    ['@babel/plugin-proposal-class-properties', { loose: false }],
    '@babel/plugin-transform-class-static-block',
    [
      'babel-plugin-inline-import', {
        extensions: [
          '.ttl'
        ]
      }
    ]
  ]
}
