/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2019 */

import * as github from "@actions/github";

export default class CheckRun {
  constructor(name, context, token) {
    this.id = null;
    this.name = name;
    this.context = context;
    this.octokit = new github.GitHub(token);

    this.ready = !!token;
  }

  async create() {
    if (!this.ready) {
      return;
    }

    let res = await this.octokit.checks.create({
      ...this.context.repo,
      head_sha: this.context.sha,
      name: "Test: " + this.name,
      status: "in_progress",
      started_at: new Date().toISOString()
    });

    this.id = res.data.id;
  }

  async complete(pass, fail, annotations) {
    if (!this.ready) {
      return;
    }

    try {
      await this.octokit.checks.update({
        ...this.context.repo,
        head_sha: this.context.sha,
        check_run_id: this.id,
        status: "completed",
        completed_at: new Date().toISOString(),
        conclusion: annotations.length ? "failure" : "success",
        output: {
          title: this.name,
          summary: `${pass} checks passed, ${fail} checks failed`,
          annotations: annotations
        }
      });
    } catch (e) {
      if (e.name == "HttpError" && e.status == 401) {
        // We have a token and it failed. Likely we've been running for quite some time, the
        // built-in token is only valid for 60 minutes. This is ok to swallow, the test will still
        // fail but we wouldn't have a check run.
        return;
      } else {
        throw e;
      }
    }
  }
}
