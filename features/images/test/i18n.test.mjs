import assert from 'node:assert/strict';
import test from 'node:test';
import {getLocale,setLocale,t} from '../web/i18n.mjs';

test('Images follows Chinese host locales, preserves user values, and switches back to English',()=>{
  setLocale('zh-TW');
  assert.equal(getLocale(),'zh-CN');
  assert.equal(t('Save as'),'另存为');
  assert.equal(t('Open {title}, {count} images',{title:'My Mountain',count:3}),'打开My Mountain，共 3 张图片');
  assert.equal(t('No images in {source}',{source:'{count}'}),'{count}中暂无图片');
  setLocale('en-US');
  assert.equal(t('Save as'),'Save as');
  assert.equal(t('{count} images',{count:2}),'2 images');
  setLocale('fr');
  assert.equal(t('Image details'),'Image details');
});
