// Usage: set custom.subscription.detailTypes and add this file to the service's resources.
import { getArn, queueName, queueWithDeadLetter } from './lib/queue.mjs';

export default async ({ resolveVariable }) => {
  const { detailTypes, ...queueOptions } = await resolveVariable('self:custom.subscription');
  const eventBusArn = await resolveVariable('param:eventBusArn');

  return {
    Resources: {
      ...queueWithDeadLetter('Events', await queueName(resolveVariable, 'events'), queueOptions),
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
