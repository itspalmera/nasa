import {useT} from '../../i18n/useT';
import OODPanel from "../../../app/ood/ood-panel";
import { useScenario } from "../../context/ScenarioContext";

/** All estimates and chart samples come from the scientific backend. */
export const GravityPredictorChart = ({token = ""}: {token?: string}) => {
  const t = useT();

  const { conditions } = useScenario();
  const initialConditions = {
    gravity: conditions.gravityG,
    oxygen: conditions.o2,
    pressureKpa: Number((conditions.pressurePsi * 6.894757293168).toFixed(4)),
    airflow: conditions.airflowCms,
  };
  return <OODPanel key={JSON.stringify(initialConditions)} token={token} initialConditions={initialConditions}/>;
};
