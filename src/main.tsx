// 引入 React 原生库
// import ReactDOM from "react-dom/client";

// 引入我们自己的库
import { createRoot } from "./lib/react-dom/ReactDOM";
// import { createRoot } from "react-dom/client";

// import App from "./App.tsx";

const root = createRoot(document.getElementById("root"));

// root.render(<App />);

const res = root.render(
  <div id="oDiv" className="test">
    <ul>
      <li>苹果</li>
      <li>香蕉</li>
      <li>西瓜</li>
    </ul>
    1111
  </div>
);
// console.log('res', res)

// root.render(1111);

