const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  entry: "./code.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "code.js",
    path: path.resolve(__dirname, "."),
    publicPath: "", // Explicitly set publicPath
    library: {
      type: "var",
      name: "plugin",
    },
    globalObject: "this", // Define the global object reference
  },
  plugins: [
    // Define any environment variables needed
    new webpack.DefinePlugin({
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL || ""
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env.SUPABASE_ANON_KEY || ""
      ),
    }),
  ],
};
