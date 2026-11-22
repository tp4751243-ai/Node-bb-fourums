<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="trust-tiers-settings">
				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Ladder · הסולם</h5>
					<p class="text-muted">
						A member gets the highest tier whose requirements they meet, together with every lower tier's requirements.
						Leave a field empty to keep the default shown in grey. Reputation may be negative (for example <code>-5</code>) to tolerate a few downvotes.
					</p>
					<div class="table-responsive">
						<table class="table table-sm align-middle">
							<thead>
								<tr>
									<th>Tier / group</th>
									<th>Badge text</th>
									<th>Posts</th>
									<th>Reputation</th>
									<th>Days since joining</th>
								</tr>
							</thead>
							<tbody>
								{{{ each tiers }}}
								<tr>
									<td class="text-nowrap">
										<i class="fa fa-fw {./icon}" style="color: {./color};"></i>
										<strong>{./level}</strong> · {./nameEn}
										<div class="text-xs text-muted">{./group}</div>
									</td>
									<td><input type="text" class="form-control form-control-sm" name="t{./level}_name" placeholder="{./name}" dir="rtl"></td>
									{{{ if ./editable }}}
									<td><input type="number" min="0" class="form-control form-control-sm" name="t{./level}_posts" placeholder="{./posts}"></td>
									<td><input type="number" class="form-control form-control-sm" name="t{./level}_reputation" placeholder="{./reputation}"></td>
									<td><input type="number" min="0" class="form-control form-control-sm" name="t{./level}_days" placeholder="{./days}"></td>
									{{{ else }}}
									<td colspan="3" class="text-muted text-sm">Every registered member who is not banned</td>
									{{{ end }}}
								</tr>
								{{{ end }}}
							</tbody>
						</table>
					</div>
				</div>

				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Rules · כללים</h5>

					<div class="form-check form-switch mb-3">
						<input type="checkbox" class="form-check-input" id="requireEmail" name="requireEmail" checked>
						<label for="requireEmail" class="form-check-label">Tier 2 and up require a confirmed email address</label>
					</div>

					<div class="mb-3">
						<label class="form-label" for="jobsCids">Jobs board category IDs · קטגוריות לוח המשרות</label>
						<input type="text" class="form-control" id="jobsCids" name="jobsCids" placeholder="e.g. 12, 13">
						<p class="form-text">
							Who may <em>open</em> a job topic is controlled by the category privilege <code>Create topics</code>:
							give it only to the tier groups (the bootstrap script grants it to tiers 2–5).
						</p>
					</div>

					<div class="mb-3">
						<label class="form-label" for="jobsAutoApproveTier">Job posts publish without moderator approval from tier</label>
						<select class="form-select" id="jobsAutoApproveTier" name="jobsAutoApproveTier">
							<option value="">Default: 3 · Line (tier 2 job posts wait for approval)</option>
							<option value="2">2 · Letter</option>
							<option value="3">3 · Line</option>
							<option value="4">4 · Page</option>
							<option value="5">5 · Book</option>
							<option value="6">Never: moderate every job post</option>
						</select>
					</div>

					<div class="mb-3">
						<label class="form-label" for="queueExemptTier">Skip NodeBB's new-member post queue from tier</label>
						<select class="form-select" id="queueExemptTier" name="queueExemptTier">
							<option value="">Default: 2 · Letter</option>
							<option value="0">Never (use NodeBB's own post queue rules only)</option>
							<option value="2">2 · Letter</option>
							<option value="3">3 · Line</option>
							<option value="4">4 · Page</option>
							<option value="5">5 · Book</option>
						</select>
					</div>

					<div class="form-check form-switch mb-3">
						<input type="checkbox" class="form-check-input" id="notifyPromotions" name="notifyPromotions" checked>
						<label for="notifyPromotions" class="form-check-label">Send members a notification when they move up a tier</label>
					</div>
				</div>

				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Manual overrides · חריגים</h5>
					<textarea class="form-control font-monospace" rows="5" name="overrides" dir="ltr" placeholder="# username = tier&#10;hotzaat_or = 4&#10;uid:17 = 2"></textarea>
					<p class="form-text">
						Pins a member to a tier regardless of activity, for example a publisher you verified by phone.
						Delete the line to return them to automatic ranking. To restrict someone, use NodeBB's ban or mute instead.
					</p>
				</div>

				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">Maintenance</h5>
					<p class="text-muted">
						Tiers update immediately on posts, votes, logins, email confirmation and bans, and an hourly sweep catches account-age promotions.
					</p>
					<button type="button" class="btn btn-outline-primary btn-sm" id="recalculate">
						<i class="fa fa-rotate"></i> Recalculate everyone now
					</button>
				</div>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
