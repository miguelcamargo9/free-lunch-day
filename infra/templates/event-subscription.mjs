// Usage: set custom.subscription.detailTypes and add this file to the service's resources.
const getArn = (logicalId) => ({ 'Fn::GetAtt': [logicalId, 'Arn'] });

export default async ({ resolveVariable }) => {
  const {
    detailTypes,
    visibilityTimeout = 60,
    maxReceiveCount = 5,
  } = await resolveVariable('self:custom.subscription');
  const service = await resolveVariable('self:service');
  const stage = await resolveVariable('sls:stage');
  const eventBusArn = await resolveVariable('param:eventBusArn');
  const queueName = `${service}-${stage}-events`;

  return {
    Resources: {
      EventsDeadLetterQueue: {
        Type: 'AWS::SQS::Queue',
        Properties: { QueueName: `${queueName}-dlq`, MessageRetentionPeriod: 1209600 },
      },
      EventsQueue: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          QueueName: queueName,
          VisibilityTimeout: visibilityTimeout,
          RedrivePolicy: { deadLetterTargetArn: getArn('EventsDeadLetterQueue'), maxReceiveCount },
        },
      },
      EventsRule: {
        Type: 'AWS::Events::Rule',
        Properties: {
          EventBusName: eventBusArn,
          EventPattern: { 'detail-type': detailTypes },
          Targets: [{ Id: 'events-queue', Arn: getArn('EventsQueue') }],
        },
      },
      EventsQueuePolicy: {
        Type: 'AWS::SQS::QueuePolicy',
        Properties: {
          Queues: [{ Ref: 'EventsQueue' }],
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'events.amazonaws.com' },
                Action: 'sqs:SendMessage',
                Resource: getArn('EventsQueue'),
                Condition: { ArnEquals: { 'aws:SourceArn': getArn('EventsRule') } },
              },
            ],
          },
        },
      },
    },
  };
};
