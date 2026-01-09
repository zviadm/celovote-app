import "core-js/stable";
import "regenerator-runtime/runtime";

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";

import App from './src/app'
import Faq from "./src/faq";
import Scores from "./src/scores";
import RewardsOnly from "./src/rewardsonly";
import SavingsCELO from "./src/savingscelo";
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from '@apollo/react-hooks';
import { celovoteGQL } from "./src/schema";

const client = new ApolloClient({ uri: celovoteGQL });

const Index = () => {
  return (
    <div>
      <p>Celovote no longer exists, following decomissioning of all validator rewards on the Celo network.</p>
      <a href="https://mondo.celo.org/governance/271">https://mondo.celo.org/governance/271</a>
    </div>
  );
}


ReactDOM.render(<Index />, document.getElementById('root'))
