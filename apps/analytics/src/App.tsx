import "./App.css";
import { Dashboard } from "./Dashboard";
import { Statistics } from "./Statistics";

const App = () => {
  return (
    <div className="content">
      <h1>Analytics</h1>
      <Dashboard />
      <Statistics />
    </div>
  );
};

export default App;
