"use client";
import Dashboard from '../research-dashboard';
import {ScenarioProvider} from '../../src/context/ScenarioContext';
export default function ResearchPage() {return <ScenarioProvider><Dashboard/></ScenarioProvider>;}
