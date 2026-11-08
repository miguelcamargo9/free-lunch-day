// Shared provider for every service. Per-service additions go in custom.provider.
export default async ({ resolveVariable }) => {
  const { environment = {}, iamStatements = [] } = await resolveVariable('self:custom.provider');
  return {
    name: 'aws',
    runtime: 'nodejs22.x',
    architecture: 'arm64',
    region: 'us-east-1',
    stage: await resolveVariable("opt:stage, 'dev'"),
    memorySize: 256,
    timeout: 10,
    logRetentionInDays: 7,
    httpApi: { cors: true },
    environment: {
      EVENT_BUS_NAME: await resolveVariable('param:eventBusName'),
      NODE_OPTIONS: '--enable-source-maps',
      ...environment,
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: 'events:PutEvents',
            Resource: await resolveVariable('param:eventBusArn'),
          },
          ...iamStatements,
        ],
      },
    },
  };
};
