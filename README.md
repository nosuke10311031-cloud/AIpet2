# AI Desktop Pet

macOSのデスクトップ上に常駐する、ローカルファーストなAIペットのMVPです。

## 現在の実装範囲

Phase 5まで完了しています。

- Tauri 2 + Vite + JavaScript
- macOS上の透明・枠なしウィンドウ
- 常時最前面表示
- Dockとタスクバーに表示しないAccessoryアプリ
- 画面右下への初期配置
- ペットのドラッグ移動
- キャラクター設定と描画の分離
- `IDLE / WALK / SLEEP / TALK` の状態マシン
- 状態ごとの差し替え可能なキャラクター表示
- Matter.jsによる重力、着地、歩行、ジャンプ、画面端の衝突
- ランダムな歩行・待機・睡眠の自律行動
- ドラッグ中の物理一時停止と、放した後の自然落下
- ペットのクリックで開く独立した会話ウィンドウ
- 会話中の`TALK`状態と、返答を表示する短い吹き出し
- `Dummy / OpenAI / Ollama`を切り替えられるLLM Provider境界
- APIキー不要で動作確認できるローカルDummy Provider
- OpenAI Responses APIとOllama Chat APIのRust側クライアント
- 最大12件に制限した会話履歴
- macOSの`NSWorkspace.frontmostApplication`を使った前面アプリ取得
- Pet UIから分離した独立`PC Sensor`
- アプリ名・Bundle ID・開始時刻・利用秒数の日別記録
- AI Desktop Pet自身を記録対象から除外し、直前の作業文脈を維持
- アプリ終了後も保持されるローカルJSONログ
- PC Sensorの情報だけを受け取る独立した`PetBehaviorEngine`
- Codex・VS Code・Xcode等では静かに見守る`IDLE`ルール
- 作業アプリが切り替わると歩き始める`WALK`ルール
- 同じアプリを25分以上使うと休憩を促す`SLEEP`ルール
- 会話中の`TALK`を行動ルールが中断しない優先制御
- 右クリックメニューからの終了

## 使い方（ターミナル不要）

1. Finderで`AI Desktop Pet.app`をダブルクリックします。
2. Mochiを短くクリックすると会話画面が開きます。
3. 入力欄へ話したいことを書いて「送信」を押します。最初は`Dummy`なのでAPIキーは不要です。
4. Mochiを移動するときは、そのままドラッグします。
5. 終了するときはMochiを右クリックして「終了」を押します。

起動中にMochiが見つからない場合は、もう一度`AI Desktop Pet.app`をダブルクリックして構いません。

## 開発時の起動

```bash
npm install
npm run tauri dev
```

起動すると画面右下にMochiが表示されます。ペットをドラッグすると移動でき、短くクリックすると会話画面が開きます。初期設定の`Dummy`ならAPIキーなしでそのまま会話できます。

## LLM Provider

会話画面の左下でProviderを選択できます。通常の動作確認には`Dummy`を使います。

- `OpenAI`: `.env`の`OPENAI_API_KEY`をRust側だけで読み込み、Responses APIを呼び出します。既定モデルは`gpt-5.6-sol`です。
- `Ollama`: ローカルの`http://127.0.0.1:11434/api/chat`を呼び出します。既定モデルは`gemma3`です。

必要になった時点で`.env.example`を`.env`へコピーして設定します。秘密情報はフロントエンドへ渡しません。

## PC利用ログ

AI Desktop Petの起動中は、前面アプリ名、Bundle ID、開始時刻、利用秒数を10秒ごとにローカル保存します。ウィンドウタイトルや画面内容、入力内容は取得しません。

macOSでは次のフォルダへ日付別のJSONを保存します。

```text
~/Library/Application Support/com.kesunonshi.ai-desktop-pet/pc-activity/
```

AI Desktop Pet自身が前面になった場合は新しい作業アプリとして記録せず、直前のChromeやCodexなどを`currentContext`として維持します。

## ビルド

```bash
npm run build
npm test
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

macOSの `.app` は `src-tauri/target/release/bundle/macos/`に生成されます。MVP期間中のデフォルトバンドル対象は `.app`のみです。DMGとコード署名は配布フェーズで追加します。

## キャラクターの差し替え

Mochiの設定は `public/characters/mochi/character.json`、画像は同じディレクトリ内にあります。レンダラーは設定ファイルを読み込むため、後続フェーズでスプライトシートへ交換できます。

## 設計メモ

- Rust/Tauri層はウィンドウのライフサイクルとmacOSネイティブ機能を担当します。
- JavaScript層はキャラクター描画とユーザー操作を担当します。
- LLMへのネットワーク通信はRust層に閉じ、ブラウザ側へAPIキーを公開しません。
- Providerは共通の`complete(messages)`境界で切り替え、UIを特定サービスへ依存させません。
- `PC Sensor`はRustのネイティブ取得・記録層とJavaScriptのポーリング層に分け、Pet UIから独立させています。
- 利用ログはTauriのアプリ専用ローカルデータ領域へ一時ファイル経由で保存します。
- `PetBehaviorEngine`は優先度・条件・クールダウン・行動を持つ宣言的ルールだけを評価し、PC Sensorや描画処理を直接知りません。
- クリックとドラッグは6pxの移動しきい値で分離し、通常クリックがネイティブウィンドウ移動として扱われないようにしています。
- キャラクター設定はアセットとコードを分離し、`idle / walk / sleep / talk` の表示を設定駆動で切り替えます。
- `PetStateMachine` は行動状態だけを管理し、画面の描画やウィンドウ移動を直接行いません。
- `PetPhysicsController` だけが連続的なウィンドウ座標を書き込み、複数のタイマーによる移動の競合を防ぎます。
- 物理座標はmacOSモニターのワークエリアを使い、Matter.jsのボディ座標をTauriウィンドウの左上座標へ変換します。
- `macOSPrivateApi` は透明ウィンドウに必要です。この設定を使うアプリはMac App Store配布の対象にできないため、将来の配布はDeveloper IDによる直接配布を想定します。

## 参考資料とOSS

現時点で参考にしたのは公開資料とアーキテクチャです。コードと素材はコピーしていません。

- [Tauri 2 Configuration](https://v2.tauri.app/reference/config/)
- [Tauri 2 Window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/)
- [OpenPets](https://github.com/alvinunreal/openpets) — MIT License。ペット表示とアプリ本体の責務分離を参考にしました。
- [OpenPets Desktop Architecture](https://github.com/alvinunreal/openpets/blob/main/docs/desktop.md)
- [KillClawd](https://github.com/ninjahawk/KillClawd) — MIT License。小さな透明・常時最前面ウィンドウというUXのみ参考にしました。
- [Matter.js](https://github.com/liabru/matter-js) — MIT License。物理エンジンとしてnpmパッケージを使用しています。
- [Matter.js API](https://brm.io/matter-js/docs/)
- [OpenAI GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- [OpenAI Responses API Quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request)
- [Ollama Chat API](https://docs.ollama.com/api/chat)
- [Apple NSWorkspace.frontmostApplication](https://developer.apple.com/documentation/appkit/nsworkspace/frontmostapplication)
- [objc2-app-kit NSWorkspace](https://docs.rs/objc2-app-kit/latest/objc2_app_kit/struct.NSWorkspace.html)
- [Tauri PathResolver](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html)
- [OpenPets Pet Motion](https://github.com/alvinunreal/openpets/blob/main/docs/pets.md) — 連続位置更新を1つのモーションエンジンに集約する設計を参考にしました。
- [OpenPets Plugin SDK](https://github.com/alvinunreal/openpets/blob/main/docs/sdk.md) — 行動側は効果を宣言し、ホスト側が描画を担当する分離設計と、時刻を注入した決定的テストを参考にしました。

## 次のフェーズ

初期MVPのPhase 1〜5は完了です。次はStretch Goalとして、アプリウィンドウの位置・サイズを取得し、その上をMochiが歩けるWindow Awarenessへ拡張できます。
