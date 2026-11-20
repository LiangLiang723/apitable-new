import { getSubscriptions } from '../../../api/datasheet_api';
import { getSubscriptionsAction, setSubscriptionsAction } from '../subscriptions';

jest.mock('../../../api/datasheet_api', () => ({ getSubscriptions: jest.fn() }));

const fetchSubscriptions = getSubscriptions as jest.MockedFunction<typeof getSubscriptions>;

function pendingResponse() {
  type Response = Awaited<ReturnType<typeof getSubscriptions>>;
  let complete: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => { complete = resolve; });
  fetchSubscriptions.mockReturnValueOnce(promise);
  return (ids: string[]) => complete({ data: { success: true, data: ids } } as Response);
}

test('a late response cannot replace subscriptions for the newer request', async () => {
  const completeOld = pendingResponse();
  const completeNew = pendingResponse();
  const dispatch = jest.fn();
  const oldRequest = getSubscriptionsAction('old-table')(dispatch);
  const newRequest = getSubscriptionsAction('new-table')(dispatch);

  completeNew(['new-record']);
  await newRequest;
  completeOld(['old-record']);
  await oldRequest;

  expect(dispatch.mock.calls).toEqual([[setSubscriptionsAction(['new-record'])]]);
});

test('requests in different stores can each publish their result', async () => {
  const completeFirst = pendingResponse();
  const completeSecond = pendingResponse();
  const firstDispatch = jest.fn();
  const secondDispatch = jest.fn();
  const firstRequest = getSubscriptionsAction('first-table')(firstDispatch);
  const secondRequest = getSubscriptionsAction('second-table')(secondDispatch);

  completeSecond(['second-record']);
  completeFirst(['first-record']);
  await Promise.all([firstRequest, secondRequest]);

  expect(firstDispatch).toHaveBeenCalledWith(setSubscriptionsAction(['first-record']));
  expect(secondDispatch).toHaveBeenCalledWith(setSubscriptionsAction(['second-record']));
});
