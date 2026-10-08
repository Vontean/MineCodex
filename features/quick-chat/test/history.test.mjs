import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryTracker} from '../src/domain/history.mjs';
const initial={sessionId:'new',hasConversation:false,historyVisible:true};
test('selecting a different existing chat expands once after history closes',()=>{
  const tracker=createHistoryTracker();tracker.open(initial);
  assert.equal(tracker.selected({...initial,historyVisible:false}),false);
  const selected={sessionId:'existing',hasConversation:true,historyVisible:false};
  assert.equal(tracker.selected(selected),true);assert.equal(tracker.selected(selected),false);
});
test('New chat consumes the preview without expanding later unrelated navigation',()=>{
  const tracker=createHistoryTracker();tracker.open(initial);
  assert.equal(tracker.selected({sessionId:'another-new',hasConversation:false}),false);
  assert.equal(tracker.selected({sessionId:'existing',hasConversation:true}),false);
});
test('minimize or dispose clears the preview without expanding on restore',()=>{
  const tracker=createHistoryTracker();tracker.open(initial);tracker.clear();
  assert.equal(tracker.selected({...initial,historyVisible:false}),false);
  assert.equal(tracker.selected({sessionId:'existing',hasConversation:true}),false);
});
test('background-mounted history does not create a selection intent',()=>{
  const tracker=createHistoryTracker();tracker.open({...initial,historyVisible:false});
  assert.equal(tracker.selected({sessionId:'existing',hasConversation:true}),false);
});
