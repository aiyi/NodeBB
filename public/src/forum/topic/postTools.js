'use strict';

/* globals define, app, translator, templates, socket, bootbox */

define(['composer'], function(composer) {

	var PostTools = {};

	PostTools.init = function(tid, threadState) {

		var topicName = templates.get('topic_name');

		$('.topic').on('click', '.post_reply', function() {
			if (threadState.locked !== '1') {
				onReplyClicked($(this), tid, topicName);
			}
		});

		$('#post-container').on('click', '.quote', function() {
			if (threadState.locked !== '1') {
				onQuoteClicked($(this), tid, topicName);
			}
		});

		$('#post-container').on('click', '.favourite', function() {
			favouritePost($(this), getPid($(this)));
		});

		$('#post-container').on('click', '.upvote', function() {
			onUpvoteClicked($(this));
		});

		$('#post-container').on('click', '.downvote', function() {
			onDownvoteClicked($(this));
		});

		$('#post-container').on('click', '.flag', function() {
			flagPost(getPid($(this)));
		});

		$('#post-container').on('click', '.edit', function(e) {
			composer.editPost(getPid($(this)));
		});

		$('#post-container').on('click', '.delete', function(e) {
			deletePost($(this), tid);
		});

		$('#post-container').on('click', '.move', function(e) {
			openMovePostModal($(this));
		});


		$('#post-container').on('click', '.chat', function(e) {
			var post = $(this).parents('li.post-row');

			app.openChat(post.attr('data-username'), post.attr('data-uid'));
			$(this).parents('.btn-group').find('.dropdown-toggle').click();
			return false;
		});

		addShareHandlers(topicName);
	};

	function onReplyClicked(button, tid, topicName) {
		var selectionText = '',
			selection = window.getSelection ? window.getSelection() : document.selection.createRange();

		if ($(selection.baseNode).parents('.post-content').length > 0) {
			var snippet = selection.toString();
			if (snippet.length > 0) {
				selectionText = '> ' + snippet.replace(/\n/g, '\n> ');
			}
		}

		var username = getUserName(button) + ' ';

		composer.newReply(tid, getPid(button), topicName, selectionText.length > 0 ? selectionText + '\n\n' + username : '' + username);
	}

	function onQuoteClicked(button, tid, topicName) {
		var username = getUserName(button),
			pid = getPid(button);

		socket.emit('posts.getRawPost', pid, function(err, post) {
			if(err) {
				return app.alertError(err.message);
			}
			var quoted = '';
			if(post) {
				quoted = '> ' + post.replace(/\n/g, '\n> ') + '\n\n';
			}

			if($('.composer').length) {
				composer.addQuote(tid, pid, topicName, username, quoted);
			} else {
				composer.newReply(tid, pid, topicName, username + ' said:\n' + quoted);
			}
		});
	}

	function favouritePost(button, pid) {
		var method = button.attr('data-favourited') === 'false' ? 'posts.favourite' : 'posts.unfavourite';

		socket.emit(method, {
			pid: pid,
			room_id: app.currentRoom
		});

		return false;
	}

	function onUpvoteClicked(button) {
		toggleVote(button, '.upvoted', 'posts.upvote');
	}

	function onDownvoteClicked(button) {
		toggleVote(button, '.downvoted', 'posts.downvote');
	}

	function toggleVote(button, className, method) {
		var post = button.parents('.post-row'),
			currentState = post.find(className).length;

		socket.emit(currentState ? 'posts.unvote' : method , {
			pid: post.attr('data-pid'),
			room_id: app.currentRoom
		});

		return false;
	}

	function getPid(button) {
		return button.parents('.post-row').attr('data-pid');
	}

	function getUserName(button) {
		var username = '',
			post = button.parents('li[data-pid]');

		if (post.length) {
			username = '@' + post.attr('data-username').replace(/\s/g, '-');
		}
		return username;
	}

	function deletePost(button, tid) {
		var pid = getPid(button),
			postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
			action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		bootbox.confirm('Are you sure you want to ' + action + ' this post?', function(confirm) {
			if (confirm) {
				socket.emit('posts.' + action, {
					pid: pid,
					tid: tid
				}, function(err) {
					if(err) {
						return app.alertError('Can\'t ' + action + ' post!');
					}
				});
			}
		});
	}

	function openMovePostModal(button) {
		var moveModal = $('#move-post-modal'),
			moveBtn = moveModal.find('#move_post_commit'),
			topicId = moveModal.find('#topicId');

		showMoveModal();

		moveModal.find('.close,#move_post_cancel').on('click', function() {
			moveModal.addClass('hide');
		});

		topicId.on('change', function() {
			if(topicId.val().length) {
				moveBtn.removeAttr('disabled');
			} else {
				moveBtn.attr('disabled', true);
			}
		});

		moveBtn.on('click', function() {
			movePost(button.parents('.post-row'), getPid(button), topicId.val());
		});
	}

	function showMoveModal() {
		$('#move-post-modal').removeClass('hide')
			.css("position", "fixed")
			.css("left", Math.max(0, (($(window).width() - $($('#move-post-modal')).outerWidth()) / 2) + $(window).scrollLeft()) + "px")
			.css("top", "0px")
			.css("z-index", "2000");
	}

	function movePost(post, pid, tid) {
		socket.emit('topics.movePost', {pid: pid, tid: tid}, function(err) {
			$('#move-post-modal').addClass('hide');

			if(err) {
				$('#topicId').val('');
				return app.alertError(err.message);
			}

			post.fadeOut(500, function() {
				post.remove();
			});

			$('#topicId').val('');

			app.alertSuccess('Post moved!');
		});
	}

	function flagPost(pid) {
		bootbox.confirm('Are you sure you want to flag this post?', function(confirm) {
			if (confirm) {
				socket.emit('posts.flag', pid, function(err) {
					if(err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('This post has been flagged for moderation.');
				});
			}
		});
	}

	function addShareHandlers(topicName) {
		$('#post-container').on('shown.bs.dropdown', '.share-dropdown', function() {
			var pid = getPid($(this));
			$('#post_' + pid + '_link').val(window.location.protocol + '//' + window.location.host + window.location.pathname + '#' + pid);
			// without the setTimeout can't select the text in the input
			setTimeout(function() {
				$('#post_' + pid + '_link').putCursorAtEnd().select();
			}, 50);
		});

		$('#post-container').on('click', '.post-link', function(e) {
			e.preventDefault();
			return false;
		});

		$('#post-container').on('click', '.twitter-share', function () {
			window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.href + '#' + getPid($(this))) + '&text=' + topicName, '_blank', 'width=550,height=420,scrollbars=no,status=no');
			return false;
		});

		$('#post-container').on('click', '.facebook-share', function () {
			window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href + '#' + getPid($(this))), '_blank', 'width=626,height=436,scrollbars=no,status=no');
			return false;
		});

		$('#post-container').on('click', '.google-share', function () {
			window.open('https://plus.google.com/share?url=' + encodeURIComponent(window.location.href + '#' + getPid($(this))), '_blank', 'width=500,height=570,scrollbars=no,status=no');
			return false;
		});
	}

	return PostTools;
});