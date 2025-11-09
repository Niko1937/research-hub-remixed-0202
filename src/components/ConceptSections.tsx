export function ConceptSections() {
  return (
    <section id="concept-section" className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 背景と課題 */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              AIは「研究実行」へ。しかし現場は「過去の把握」と「結果の言語化」に追われている
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AIの進化は凄まじく、Microsoft DiscoveryやAlphaEvolveのようにAIが研究プロセスそのものを実行する段階に入っています。
              しかし多くの組織では「過去の社内資料はどこに？」「誰が詳しい？」といった<strong className="text-foreground">ナレッジの把握</strong>と、
              AIが出した成果を<strong className="text-foreground">報告書に言語化する作業</strong>が依然として最大の課題です。
            </p>
          </div>

          {/* 現在の機能 */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              今できること（最小構成の7機能）
            </h2>
            <ul className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
              <li>• <strong className="text-foreground">論文検索</strong> - 外部API連携で関連文献を収集</li>
              <li>• <strong className="text-foreground">テーマ評価</strong> - 社内 vs 外部の研究動向を分析</li>
              <li>• <strong className="text-foreground">専門家検索</strong> - 関連分野の専門家を推薦</li>
              <li>• <strong className="text-foreground">ポジショニング分析</strong> - 動的軸生成と3種類のチャート</li>
              <li>• <strong className="text-foreground">シーズ・ニーズマッチング</strong> - 技術と課題の接続</li>
              <li>• <strong className="text-foreground">HTML報告書生成</strong> - インフォグラフィック自動作成</li>
              <li>• <strong className="text-foreground">PDF閲覧・対話</strong> - 文献との対話的学習</li>
            </ul>
          </div>

          {/* 本質は拡張性 */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              本質は「拡張性」：Agentベースアーキテクチャ
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              このToyAppが示したいのは、<strong className="text-foreground">対話UIの裏側でAgentを疎結合に組み合わせる設計</strong>です。
              現在は最小限のAgentですが、将来的に「社内ナレッジ検索Agent」「リアルタイム専門家推薦Agent」
              「定例報告書自動生成Agent」などを追加するだけで、複雑な研究活動を対話的に支援できるようになります。
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              よくある質問
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium text-foreground">Q. なぜ機能が少ない？</p>
                <p className="text-muted-foreground">A. Agent設計の「拡張性」を示す最小構成だからです。</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Q. 社内資料は見られる？</p>
                <p className="text-muted-foreground">A. 現状は未実装。将来Agentを追加して対応可能です。</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Q. なぜChat UI？</p>
                <p className="text-muted-foreground">A. 多様なAgentを柔軟に呼び出せる最適なインターフェースだからです。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
