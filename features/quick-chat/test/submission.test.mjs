import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionTracker} from '../src/domain/submission.mjs';
const snapshot = (overrides={}) => ({sessionId:'chat-a',canSubmit:true,hasConversation:true,receiptId:1,receiptPresentation:'compact',...overrides});
test('focus, history loading and blocked submission never expand',()=>{
  const tracker=createSubmissionTracker();
  assert.equal(tracker.accepted(snapshot({receiptId:2})),false);
  tracker.begin(snapshot({canSubmit:false}));
  assert.equal(tracker.accepted(snapshot({receiptId:2})),false);
});
test('first submission waits for native conversation acceptance and expands once',()=>{
  const tracker=createSubmissionTracker();tracker.begin(snapshot({hasConversation:false,receiptId:0}));
  assert.equal(tracker.accepted(snapshot({hasConversation:false,receiptId:2})),false);
  assert.equal(tracker.accepted(snapshot({receiptId:2})),true);
  assert.equal(tracker.accepted(snapshot({receiptId:2})),false);
});
test('continuation requires a new native receipt, not a loading or title change',()=>{
  const tracker=createSubmissionTracker();tracker.begin(snapshot());
  assert.equal(tracker.accepted(snapshot()),false);
  assert.equal(tracker.accepted(snapshot({receiptId:2})),true);
});
test('switching chats or disposing cancels a pending submission',()=>{
  const tracker=createSubmissionTracker();tracker.begin(snapshot());
  assert.equal(tracker.accepted(snapshot({sessionId:'chat-b',receiptId:2})),false);
  assert.equal(tracker.accepted(snapshot({receiptId:2})),false);
  tracker.begin(snapshot());tracker.clear();assert.equal(tracker.accepted(snapshot({receiptId:2})),false);
});
