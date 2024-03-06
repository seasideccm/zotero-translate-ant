/* eslint-disable @typescript-eslint/no-var-requires */

// esbuild 编译 package.json      "script": "ccc": "esbuild src/modules/ui/testjsx.jsx --outfile=testout.js",
const require = window.require;
const React = require("react");
const ReactDOM = require("react-dom");

function Welcome(props) {
  return <h1>Hello, {props.name}</h1>;
}

function App() {
  return (
    <div>
      <Welcome name="Sara" />
      <Welcome name="Cahal" />
      <Welcome name="Edite" />
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
