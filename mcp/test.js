import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfigFilePath } from './opensubtitles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('--- Starting SyncForge MCP Integration Tests ---');

  const configPath = getConfigFilePath();
  const originalConfigExisted = fs.existsSync(configPath);
  const originalConfigData = originalConfigExisted ? fs.readFileSync(configPath, 'utf8') : null;

  const serverScript = path.join(__dirname, 'index.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript],
    env: process.env,
  });

  const client = new Client(
    {
      name: 'syncforge-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    console.log('Connecting to SyncForge MCP server...');
    await client.connect(transport);
    console.log('✓ Successfully connected and initialized handshake');

  // 1. Test Tools List
  console.log('Testing tools/list...');
  const toolsResult = await client.listTools();
  if (!toolsResult.tools || toolsResult.tools.length < 9) {
    throw new Error(`Expected at least 9 tools, got ${toolsResult.tools?.length}`);
  }
  const toolNames = toolsResult.tools.map(t => t.name);
  console.log(`✓ Found ${toolsResult.tools.length} tools:`, toolNames.join(', '));

  const expectedTools = [
    'syncforge_check_dependencies',
    'syncforge_inspect_media',
    'syncforge_calculate_audio_delay',
    'syncforge_sync_subtitles',
    'syncforge_set_track_flags',
    'syncforge_extract_track',
    'syncforge_filter_and_clean_tracks',
    'syncforge_merge_tracks',
    'syncforge_preview_mpv',
    'syncforge_list_modules',
    'syncforge_match_episodes',
    'syncforge_wavesync_injection',
    'syncforge_sync_subs_from_mkv',
    'syncforge_convert_audio_opus',
    'syncforge_extract_attachments',
    'syncforge_run_batch',
    'syncforge_search_subtitles_online',
    'syncforge_download_subtitle_online',
    'syncforge_auto_fetch_and_sync_subtitle',
    'syncforge_configure_opensubtitles',
  ];
  for (const name of expectedTools) {
    if (!toolNames.includes(name)) {
      throw new Error(`Missing expected tool: ${name}`);
    }
  }

  // 2. Test Tool Execution: syncforge_check_dependencies
  console.log('Testing callTool: syncforge_check_dependencies...');
  const checkResult = await client.callTool({
    name: 'syncforge_check_dependencies',
    arguments: {},
  });
  if (!checkResult.content || checkResult.content.length === 0) {
    throw new Error('Tool call returned no content');
  }
  const healthData = JSON.parse(checkResult.content[0].text);
  if (!healthData.tools || !healthData.syncforge_version) {
    throw new Error('Health data missing required fields');
  }
  console.log(`✓ check_dependencies output received (SyncForge v${healthData.syncforge_version}, ffmpeg found: ${healthData.tools.ffmpeg?.found})`);

  // 3. Test Tool Execution: syncforge_list_modules
  console.log('Testing callTool: syncforge_list_modules...');
  const modulesResult = await client.callTool({
    name: 'syncforge_list_modules',
    arguments: {},
  });
  const modulesData = JSON.parse(modulesResult.content[0].text);
  if (modulesData.length !== 7) {
    throw new Error(`Expected 7 modules, got ${modulesData.length}`);
  }
  console.log(`✓ list_modules returned 7 modules: ${modulesData.map(m => m.id).join(', ')}`);

  // 4. Test Tool Execution: syncforge_inspect_media on directory
  console.log('Testing callTool: syncforge_inspect_media on project root...');
  const inspectResult = await client.callTool({
    name: 'syncforge_inspect_media',
    arguments: { path: path.resolve(__dirname, '..') },
  });
  const inspectData = JSON.parse(inspectResult.content[0].text);
  if (inspectData.kind !== 'folder') {
    throw new Error(`Expected folder kind, got ${inspectData.kind}`);
  }
  console.log(`✓ inspect_media folder output received (name: ${inspectData.name})`);

  // 4b. Test Tool Execution: syncforge_match_episodes
  console.log('Testing callTool: syncforge_match_episodes...');
  const matchResult = await client.callTool({
    name: 'syncforge_match_episodes',
    arguments: {
      target_paths: ['/videos/Breaking.Bad.S01E01.1080p.mkv', '/videos/Breaking.Bad.S01E02.1080p.mkv'],
      source_paths: ['/subs/bb.1x02.ita.srt', '/subs/bb.1x01.ita.srt'],
    },
  });
  const matchData = JSON.parse(matchResult.content[0].text);
  if (!matchData.matched_pairs || matchData.matched_pairs.length !== 2) {
    throw new Error(`Expected 2 matched pairs, got ${matchData.matched_pairs?.length}`);
  }
  if (matchData.matched_pairs[0].episode !== 1 || matchData.matched_pairs[1].episode !== 2) {
    throw new Error('Episode ordering incorrect');
  }
  console.log('✓ match_episodes successfully paired S01E01 <-> 1x01 and S01E02 <-> 1x02');

  // 4c. Test Tool Execution: syncforge_search_subtitles_online (verifying API key validation)
  console.log('Testing callTool: syncforge_search_subtitles_online key validation...');
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
  const osResult = await client.callTool({
    name: 'syncforge_search_subtitles_online',
    arguments: { query: 'The Matrix' },
  });
  if (!osResult.isError || !osResult.content[0].text.includes('API Key is required')) {
    throw new Error('Expected API Key validation error');
  }
  console.log('✓ syncforge_search_subtitles_online properly validated API key requirement');

  // 4d. Test Tool Execution: syncforge_configure_opensubtitles
  console.log('Testing callTool: syncforge_configure_opensubtitles...');
  const cfgResult = await client.callTool({
    name: 'syncforge_configure_opensubtitles',
    arguments: {
      api_key: 'test_consumer_key_xyz123',
      user_token: 'test_user_token_abc456',
    },
  });
  const cfgData = JSON.parse(cfgResult.content[0].text);
  if (cfgData.status !== 'ok' || !cfgData.config_path) {
    throw new Error('Failed to save OpenSubtitles configuration');
  }
  console.log('✓ syncforge_configure_opensubtitles saved config successfully to:', cfgData.config_path);

  // 5. Test Resources List & Read
  console.log('Testing resources/list and resources/read...');
  const resList = await client.listResources();
  if (resList.resources.length !== 3) {
    throw new Error(`Expected 3 resources, got ${resList.resources.length}`);
  }
  console.log(`✓ Found ${resList.resources.length} resources:`, resList.resources.map(r => r.uri).join(', '));

  const readConfig = await client.readResource({ uri: 'syncforge://config' });
  if (!readConfig.contents || readConfig.contents.length === 0) {
    throw new Error('Failed to read syncforge://config');
  }
  const configObj = JSON.parse(readConfig.contents[0].text);
  if (configObj.version !== '3.3.1') {
    throw new Error(`Expected version 3.3.1 in config, got ${configObj.version}`);
  }
  if (!configObj.opensubtitles?.configured) {
    throw new Error('Expected opensubtitles to be configured');
  }
  console.log(`✓ Successfully read syncforge://config (opensubtitles configured: true, preview: ${configObj.opensubtitles.key_preview})`);

  // 6. Test Prompts List & Get
  console.log('Testing prompts/list and prompts/get...');
  const promptList = await client.listPrompts();
  if (promptList.prompts.length !== 3) {
    throw new Error(`Expected 3 prompts, got ${promptList.prompts.length}`);
  }
  console.log(`✓ Found ${promptList.prompts.length} prompts:`, promptList.prompts.map(p => p.name).join(', '));

  const promptContent = await client.getPrompt({
    name: 'inspect_and_clean_mkv',
    arguments: { mkv_path: '/path/to/movie.mkv', preferred_audio_lang: 'ita' },
  });
  if (!promptContent.messages || promptContent.messages.length === 0) {
    throw new Error('Prompt messages empty');
  }
  console.log('✓ Successfully generated prompt message for inspect_and_clean_mkv');

  } finally {
    await client.close().catch(() => {});
    if (originalConfigExisted && originalConfigData !== null) {
      try {
        fs.writeFileSync(configPath, originalConfigData, 'utf8');
      } catch {}
    } else {
      try {
        fs.unlinkSync(configPath);
      } catch {}
    }
  }
  console.log('\n--- ALL MCP INTEGRATION TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
