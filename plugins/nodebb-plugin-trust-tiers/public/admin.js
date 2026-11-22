'use strict';

define('admin/plugins/trust-tiers', ['settings', 'api', 'alerts'], function (Settings, api, alerts) {
	const ACP = {};

	ACP.init = function () {
		const form = $('.trust-tiers-settings');
		Settings.load('trust-tiers', form);

		$('#save').on('click', function () {
			Settings.save('trust-tiers', form, function () {
				alerts.success('Saved. Members are being re-ranked in the background.');
			});
		});

		$('#recalculate').on('click', function () {
			const button = $(this).prop('disabled', true);
			api.post('/plugins/trust-tiers/recalculate', {}).then(function (result) {
				alerts.success('Checked ' + result.checked + ' members, updated ' + result.changed + '.');
			}).catch(alerts.error).finally(function () {
				button.prop('disabled', false);
			});
		});
	};

	return ACP;
});
