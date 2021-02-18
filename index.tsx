import "core-js/stable";
import "regenerator-runtime/runtime";

import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";

import App from './src/app'
import Faq from "./src/faq";
import Scores from "./src/scores";
import RewardsOnly from "./src/rewardsonly";
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from '@apollo/react-hooks';
import { celovoteGQL } from "./src/schema";

const client = new ApolloClient({uri: celovoteGQL});

const Index = () => {
  return (
    <ApolloProvider client={client}>
      <Router>
        <Switch>
          <Route component={Faq} path="/faq" />
          <Route component={Scores} path="/scores" />
          <Route component={RewardsOnly} path="/rewards" />
          <Route component={App} path="/" />
        </Switch>
      </Router>
    </ApolloProvider>
  );
}


ReactDOM.render(<Index/>, document.getElementById('root'))
