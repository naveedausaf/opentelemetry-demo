// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import Document, { DocumentContext, Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';
import { context, propagation } from '@opentelemetry/api';

const { ENV_PLATFORM, WEB_OTEL_SERVICE_NAME, PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, OTEL_COLLECTOR_HOST } =
  process.env;

export default class MyDocument extends Document<{ envString: string }> {
  //If we want to customise the props that the paeg
  //component would receive, we return them from this function
  //This deprecated method of retutrning props for page components
  //executes bo hon the server side and then again on the client side
  //during pae transitions [SOURCE:
  //https://nextjs.org/docs/pages/api-reference/functions/get-initial-props]
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: App => props => sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      const baggage = propagation.getBaggage(context.active());
      const isSyntheticRequest = baggage?.getEntry('synthetic_request')?.value === 'true';

      const otlpTracesEndpoint = isSyntheticRequest
        ? `http://${OTEL_COLLECTOR_HOST}:4318/v1/traces`
        : PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

      //Other than handilng style-components
      //(a use case illustrated on Nex.js documentation
      //for getInitialProps) the only other thing
      //this customisation of _document.ts sems to be
      //doing is making config settings available in
      //objectENV in window.
      //
      //See the script tag
      //in render method of this class below
      //where the following string - that sets
      //windo.ENV- is injected via dangerouslySetInnerHTML
      //property of the script tag.
      //
      //Of the config settings made available this
      //way, all come from process.env - these are
      //bundled in by Webpack during build - except
      //IS_SYNTHETIC_REQUEST which is read from the
      //baggage received as part of propagated
      //context in HTTP request. This config property is
      //extract using propagation API (see
      //import { context, propagation } from '@opentelemetry/api';
      //at the top of the page). From the documentation page
      //for the Frontend service in Open Telemetry Demo,
      //(https://opentelemetry.io/docs/demo/services/frontend/),
      //this preprty is only there for the app to know
      //when an incoming request has been made by the
      //Load generator inculded in the demo). So,
      //THIS IS NOT A PROPERTY WE NEED.
      //
      //Of the other properties set in `window.ENV`:
      //ENV_PLATFORM and WEB_OTEL_SERVICE_NAME are set
      //directly from app config properties
      //available on the server side (as they are
      //read from process.env on top o the page
      //and are not prefixed with NEXT_PUBLIC_)
      //THESE WE WOULD NEED TO PROVIDE VIA .env.local
      //or as environment variables in a deployed environment
      //
      //Not sure why these are renamed to NEXT_PUBLIC_xxx
      //in `window.ENV` as NEXT_PUBLIC_ prefix is used
      //to indicate to the bundler that a property
      //access as `process.env.NEXT_PUBLIC_xxx`
      //will need to be available o nteh client side
      //and so should be made available in the client
      //bundle. This cannot be the reason for prefixing
      //these  properties here.
      //
      //The fourth proeprty in `window.ENV` is
      //NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      //and is presumablly the OTLP endpoint to which
      //traces would be exported. This is set to
      //isSyntheticRequest value (extractd from baggage as
      //described above) to either local Collector's endpoint
      //or the remote OTLP ndpoint (such as Azure Monitor's
      //OTLD endpoint?).
      //Since we will not be using isSyntheticRequest variable
      //we an just set it to the remote OTLP endpoint
      //for Application Insights/azure Monitor.
      //THIS MAY NOT BE POSSIBLE IF SPECIFIC AppInsights
      //EXPORTER IS NEEDED TO WRITE TO APPINSIGHTS.
      //AS DESCRIBED HERE:
      //
      //https://maxwellweru.com/blog/2024/03/nextjs-opentelemetry-with-azure-monitor
      //
      //This local exporter also
      //uses the ApplicationIsnghts Connection String.
      //If we could figure out how to use it
      //with the generic OTLP exporter to write to
      //remote Azure Monitore OTLP endpoint, we may not
      //need this exporter???
      //
      //CONCLUSIONS:
      //------------
      //
      //1. All config properties set in window.ENV
      //can be read from process.env SINCE we do not need
      //to use, and therfore do not extract, isSyntheticRequest
      //from OTel baggage reeived in incoming HTTP request
      //as part of propagated Trace Context.
      //
      //2. If we also do not using Style Components, we
      //do not need to customise _document at all and
      //the default _document.tsx should be perfectly fine.
      const envString = `
        window.ENV = {
          NEXT_PUBLIC_PLATFORM: '${ENV_PLATFORM}',
          NEXT_PUBLIC_OTEL_SERVICE_NAME: '${WEB_OTEL_SERVICE_NAME}',
          NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '${otlpTracesEndpoint}',
          IS_SYNTHETIC_REQUEST: '${isSyntheticRequest}',
        };`;
      return {
        ...initialProps,
        styles: [initialProps.styles, sheet.getStyleElement()],
        envString,
      };
    } finally {
      sheet.seal();
    }
  }

  //Since we have chosen to customise the Document by
  //providing a (now deprecated in favour of getServrSideProps and
  //getStaticProps) getInitialProps method, we need to provide
  //the actual React function component for the _document in `render`
  //method of the document 9that is now a class)

  render() {
    return (
      <Html>
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&display=swap"
            rel="stylesheet"
          />
          <title>OTel demo</title>
        </Head>
        <body>
          <Main />
          {/*In React dangerouslySetInnerHTML attribute 
          allows us to provide innerHTML using code.
          This clearly breaks the React model of returning 
          ReactDOM graphs from componetns' render functions
          that is then reconciled with the broswser's DOM
          with FiberNode tree intermediating between the two.
          This is one reasons why it is named as such.
          
          The other is that using this atribute
          could open the users up to XSS attacks.

          Details given here: 
          https://legacy.reactjs.org/docs/dom-elements.html
          
          __html property of the object to which this
          property is set contains the raw HTML as shown 
          below.
          
          Here __html is being set to the prop
          `envString` that will be passed to the document
          (how? does getInitialPageProps actally get passed
          to the document and then to the page component?)
          
          */}
          <script dangerouslySetInnerHTML={{ __html: this.props.envString }}></script>
          <NextScript />
        </body>
      </Html>
    );
  }
}
