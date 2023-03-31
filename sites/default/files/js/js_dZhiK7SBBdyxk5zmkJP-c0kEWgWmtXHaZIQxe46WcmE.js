(function ($) {

  /**
   * Add an asterisk or other marker to the changed row.
   */
  Drupal.tableDrag.prototype.row.prototype.markChanged = function () {
    var $cell = $('td:first', this.element);
    // Find the first appropriate place to insert the marker.
    var $target = $($cell.find('.file-size').get(0) || $cell.find('.file').get(0) || $cell.find('.tabledrag-handle').get(0));
    if (!$cell.find('.tabledrag-changed').length) {
      $target.after(' ' + Drupal.theme('tableDragChangedMarker') + ' ');
    }
  };

})(jQuery);
;
(function ($) {

  /**
   * Attaches the autocomplete behavior to all required fields.
   */
  Drupal.behaviors.autocomplete = {
    attach: function (context) {
      var $context = $(context);
      var acdb = [];
      $context.find('input.autocomplete').once('autocomplete', function () {
        var uri = this.value;
        if (!acdb[uri]) {
          acdb[uri] = new Drupal.ACDB(uri);
        }
        var $input = $context.find('#' + this.id.substr(0, this.id.length - 13))
          .attr('autocomplete', 'OFF')
          .attr('aria-autocomplete', 'list');
        $context.find($input[0].form).submit(Drupal.autocompleteSubmit);
        $input.parents('.form-item')
          .attr('role', 'application')
          .append($('<span class="element-invisible" aria-live="assertive"></span>')
            .attr('id', $input.attr('id') + '-autocomplete-aria-live')
          );
        new Drupal.jsAC($input, acdb[uri], $context);
      });
    }
  };

  /**
   * Prevents the form from submitting if the suggestions popup is open
   * and closes the suggestions popup when doing so.
   */
  Drupal.autocompleteSubmit = function () {
    // NOTE: Do not return true as this is non-standard. Keep it similar to
    // core. If another contrib project alters this functionality, then it is
    // the responsibility of a sub-theme to override this method and combine
    // this project with the other project.
    return $('.form-autocomplete > .dropdown').each(function () {
      this.owner.hidePopup();
    }).length == 0;
  };

  /**
   * Highlights a suggestion.
   */
  Drupal.jsAC.prototype.highlight = function (node) {
    if (this.selected) {
      $(this.selected).removeClass('active');
    }
    $(node).addClass('active');
    this.selected = node;
    $(this.ariaLive).html($(this.selected).html());
  };

  /**
   * Unhighlights a suggestion.
   */
  Drupal.jsAC.prototype.unhighlight = function (node) {
    $(node).removeClass('active');
    this.selected = false;
    $(this.ariaLive).empty();
  };

  /**
   * Positions the suggestions popup and starts a search.
   */
  Drupal.jsAC.prototype.populatePopup = function () {
    var $input = $(this.input);
    // Show popup.
    if (this.popup) {
      $(this.popup).remove();
    }
    this.selected = false;
    this.popup = $('<div class="dropdown"></div>')[0];
    this.popup.owner = this;
    $input.parent().after(this.popup);

    // Do search.
    this.db.owner = this;
    this.db.search(this.input.value);
  };

  /**
   * Fills the suggestion popup with any matches received.
   */
  Drupal.jsAC.prototype.found = function (matches) {
    // If no value in the textfield, do not show the popup.
    if (!this.input.value.length) {
      return false;
    }

    // Prepare matches.
    var ul = $('<ul class="dropdown-menu"></ul>');
    var ac = this;
    ul.css({
      display: 'block',
      right: 0
    });
    for (var key in matches) {
      $('<li></li>')
        .html($('<a href="#"></a>').html(matches[key]).on('click', function (e) {
          e.preventDefault();
        }))
        .on('mousedown', function () {
          ac.hidePopup(this);
        })
        .on('mouseover', function () {
          ac.highlight(this);
        })
        .on('mouseout', function () {
          ac.unhighlight(this);
        })
        .data('autocompleteValue', key)
        .appendTo(ul);
    }

    // Show popup with matches, if any.
    if (this.popup) {
      if (ul.children().length) {
        $(this.popup).empty().append(ul).show();
        $(this.ariaLive).html(Drupal.t('Autocomplete popup'));
      }
      else {
        $(this.popup).css({visibility: 'hidden'});
        this.hidePopup();
      }
    }
  };

  /**
   * Finds the next sibling item.
   */
  Drupal.jsAC.prototype.findNextSibling = function (element) {
    var sibling = element && element.nextSibling;
    if (sibling && !this.validItem(sibling)) {
      return this.findNextSibling(sibling.nextSibling);
    }
    return sibling;
  };

  /**
   * Finds the previous sibling item.
   */
  Drupal.jsAC.prototype.findPreviousSibling = function (element) {
    var sibling = element && element.previousSibling;
    if (sibling && !this.validItem(sibling)) {
      return this.findPreviousSibling(sibling.previousSibling);
    }
    return sibling;
  };

  /**
   * Highlights the next suggestion.
   */
  Drupal.jsAC.prototype.selectDown = function () {
    var sibling = this.findNextSibling(this.selected);
    if (sibling) {
      this.highlight(sibling);
    }
    else if (this.popup) {
      var lis = $('li', this.popup);
      if (lis.length > 0) {
        if (this.validItem(lis[0])) {
          this.highlight(lis[0]);
        }
        else {
          this.highlight(this.findNextSibling(lis[0]));
        }
      }
    }
  };

  /**
   * Highlights the previous suggestion.
   */
  Drupal.jsAC.prototype.selectUp = function () {
    var sibling = this.findPreviousSibling(this.selected);
    if (sibling) {
      this.highlight(sibling);
    }
    else if (this.popup) {
      var lis = $('li', this.popup);
      if (lis.length > 0) {
        if (this.validItem(lis[lis.length - 1])) {
          this.highlight(lis[lis.length - 1]);
        }
        else {
          this.highlight(this.findPreviousSibling(lis[lis.length - 1]));
        }
      }
    }
  };

  /**
   * Ensures the item is valid.
   */
  Drupal.jsAC.prototype.validItem = function (element) {
    return !$(element).is('.dropdown-header, .divider, .disabled');
  };

  Drupal.jsAC.prototype.setStatus = function (status) {
    var $throbber = $(this.input).parent().find('.glyphicon-refresh, .autocomplete-throbber').first();
    var throbbingClass = $throbber.is('.autocomplete-throbber') ? 'throbbing' : 'glyphicon-spin';
    switch (status) {
      case 'begin':
        $throbber.addClass(throbbingClass);
        $(this.ariaLive).html(Drupal.t('Searching for matches...'));
        break;
      case 'cancel':
      case 'error':
      case 'found':
        $throbber.removeClass(throbbingClass);
        break;
    }
  };

  // Save the previous autocomplete prototype.
  var oldPrototype = Drupal.jsAC.prototype;

  /**
   * Override the autocomplete constructor.
   */
  Drupal.jsAC = function ($input, db, context) {
    var ac = this;

    // Context is normally passed by Drupal.behaviors.autocomplete above. However,
    // if a module has manually invoked this method they will likely not know
    // about this feature and a global fallback context to document must be used.
    // @see https://www.drupal.org/node/2594243
    // @see https://www.drupal.org/node/2315295
    this.$context = context && $(context) || $(document);

    this.input = $input[0];
    this.ariaLive = this.$context.find('#' + this.input.id + '-autocomplete-aria-live');
    this.db = db;
    $input
      .keydown(function (event) {
        return ac.onkeydown(this, event);
      })
      .keyup(function (event) {
        ac.onkeyup(this, event);
      })
      .blur(function () {
        ac.hidePopup();
        ac.db.cancel();
      });
  };

  // Restore the previous prototype.
  Drupal.jsAC.prototype = oldPrototype;

})(jQuery);
;
(function ($) {
  // Override core JS so it works with "button" tags.
  /**
   * Attach behaviors to the file upload and remove buttons.
   */
  Drupal.behaviors.fileButtons = {
    attach: function (context) {
      $(':input.form-submit', context).bind('mousedown', Drupal.file.disableFields);
      $('div.form-managed-file :input.form-submit', context).bind('mousedown', Drupal.file.progressBar);
    },
    detach: function (context) {
      $(':input.form-submit', context).unbind('mousedown', Drupal.file.disableFields);
      $('div.form-managed-file :input.form-submit', context).unbind('mousedown', Drupal.file.progressBar);
    }
  };
  if (Drupal.file) {
    /**
     * Prevent file uploads when using buttons not intended to upload.
     */
    Drupal.file.disableFields = function (event){
      var clickedButton = this;

      // Only disable upload fields for Ajax buttons.
      if (!$(clickedButton).hasClass('ajax-processed')) {
        return;
      }

      // Check if we're working with an "Upload" button.
      var $enabledFields = [];
      if ($(this).closest('div.form-managed-file').length > 0) {
        $enabledFields = $(this).closest('div.form-managed-file').find(':input.form-file');
      }

      // Temporarily disable upload fields other than the one we're currently
      // working with. Filter out fields that are already disabled so that they
      // do not get enabled when we re-enable these fields at the end of behavior
      // processing. Re-enable in a setTimeout set to a relatively short amount
      // of time (1 second). All the other mousedown handlers (like Drupal's Ajax
      // behaviors) are excuted before any timeout functions are called, so we
      // don't have to worry about the fields being re-enabled too soon.
      // @todo If the previous sentence is true, why not set the timeout to 0?
      var $fieldsToTemporarilyDisable = $('div.form-managed-file :input.form-file').not($enabledFields).not(':disabled');
      $fieldsToTemporarilyDisable.attr('disabled', 'disabled');
      setTimeout(function (){
        $fieldsToTemporarilyDisable.attr('disabled', false);
      }, 1000);
    };
    /**
     * Add progress bar support if possible.
     */
    Drupal.file.progressBar = function (event) {
      var clickedButton = this;
      var $progressId = $(clickedButton).closest('div.form-managed-file').find(':input.file-progress');
      if ($progressId.length) {
        var originalName = $progressId.attr('name');

        // Replace the name with the required identifier.
        $progressId.attr('name', originalName.match(/APC_UPLOAD_PROGRESS|UPLOAD_IDENTIFIER/)[0]);

        // Restore the original name after the upload begins.
        setTimeout(function () {
          $progressId.attr('name', originalName);
        }, 1000);
      }
      // Show the progress bar if the upload takes longer than half a second.
      setTimeout(function () {
        $(clickedButton).closest('div.form-managed-file').find('div.ajax-progress-bar').slideDown();
      }, 500);
    };

    /**
     * Styling invalid file extension error message (Issue #2331595 by NetTantra).
     */
    Drupal.file.validateExtension = function (event) {
      // Remove any previous errors.
      $('.file-upload-js-error').remove();

      // Add client side validation for the input[type=file].
      var extensionPattern = event.data.extensions.replace(/,\s*/g, '|');
      if (extensionPattern.length > 1 && this.value.length > 0) {
        var acceptableMatch = new RegExp('\\.(' + extensionPattern + ')$', 'gi');
        if (!acceptableMatch.test(this.value)) {
          var error = Drupal.t("The selected file %filename cannot be uploaded. Only files with the following extensions are allowed: %extensions.", {
            // According to the specifications of HTML5, a file upload control
            // should not reveal the real local path to the file that a user
            // has selected. Some web browsers implement this restriction by
            // replacing the local path with "C:\fakepath\", which can cause
            // confusion by leaving the user thinking perhaps Drupal could not
            // find the file because it messed up the file path. To avoid this
            // confusion, therefore, we strip out the bogus fakepath string.
            '%filename': this.value.replace('C:\\fakepath\\', ''),
            '%extensions': extensionPattern.replace(/\|/g, ', ')
          });
          $(this).closest('div.form-managed-file').parents('.form-item').first().prepend('<div class="alert alert-danger alert-dismissible messages error file-upload-js-error" aria-live="polite" role="alert">\
            <button type="button" class="close" data-dismiss="alert">\
              <span aria-hidden="true">&times;</span>\
              <span class="sr-only">Close</span>\
            </button>' + error + '</div>');
          this.value = '';
          return false;
        }
      }
    };
  }
})(jQuery);
;
(function($) {
  // Unbind core state.js from document first so we can then override below.
  $(document).unbind('state:disabled');

  /**
   * Global state change handlers. These are bound to "document" to cover all
   * elements whose state changes. Events sent to elements within the page
   * bubble up to these handlers. We use this system so that themes and modules
   * can override these state change handlers for particular parts of a page.
   */
  $(document).bind('state:disabled', function(e) {
    // Only act when this change was triggered by a dependency and not by the
    // element monitoring itself.
    if (e.trigger) {
      $(e.target)
        .attr('disabled', e.value)
        .closest('.form-item, .form-submit, .form-wrapper').toggleClass('form-disabled', e.value)
        .find(':input').attr('disabled', e.value);

      // Note: WebKit nightlies don't reflect that change correctly.
      // See https://bugs.webkit.org/show_bug.cgi?id=23789
    }
  });
})(jQuery);
;
(function ($) {

/**
 * Override Drupal's AJAX prototype beforeSend function so it can append the
 * throbber inside the pager links.
 */
Drupal.ajax.prototype.beforeSend = function (xmlhttprequest, options) {
  // For forms without file inputs, the jQuery Form plugin serializes the form
  // values, and then calls jQuery's $.ajax() function, which invokes this
  // handler. In this circumstance, options.extraData is never used. For forms
  // with file inputs, the jQuery Form plugin uses the browser's normal form
  // submission mechanism, but captures the response in a hidden IFRAME. In this
  // circumstance, it calls this handler first, and then appends hidden fields
  // to the form to submit the values in options.extraData. There is no simple
  // way to know which submission mechanism will be used, so we add to extraData
  // regardless, and allow it to be ignored in the former case.
  if (this.form) {
    options.extraData = options.extraData || {};

    // Let the server know when the IFRAME submission mechanism is used. The
    // server can use this information to wrap the JSON response in a TEXTAREA,
    // as per http://jquery.malsup.com/form/#file-upload.
    options.extraData.ajax_iframe_upload = '1';

    // The triggering element is about to be disabled (see below), but if it
    // contains a value (e.g., a checkbox, textfield, select, etc.), ensure that
    // value is included in the submission. As per above, submissions that use
    // $.ajax() are already serialized prior to the element being disabled, so
    // this is only needed for IFRAME submissions.
    var v = $.fieldValue(this.element);
    if (v !== null) {
      options.extraData[this.element.name] = v;
    }
  }

  var $element = $(this.element);

  // Disable the element that received the change to prevent user interface
  // interaction while the Ajax request is in progress. ajax.ajaxing prevents
  // the element from triggering a new request, but does not prevent the user
  // from changing its value.
  $element.addClass('progress-disabled').attr('disabled', true);

  // Insert progressbar or throbber.
  if (this.progress.type == 'bar') {
    var progressBar = new Drupal.progressBar('ajax-progress-' + this.element.id, eval(this.progress.update_callback), this.progress.method, eval(this.progress.error_callback));
    if (this.progress.message) {
      progressBar.setProgress(-1, this.progress.message);
    }
    if (this.progress.url) {
      progressBar.startMonitoring(this.progress.url, this.progress.interval || 500);
    }
    this.progress.element = $(progressBar.element).addClass('ajax-progress ajax-progress-bar');
    this.progress.object = progressBar;
    if (!$element.closest('.file-widget,.form-item').length) {
      $element.before(this.progress.element);
    }
    else {
      $element.closest('.file-widget,.form-item').after(this.progress.element);
    }
  }
  else if (this.progress.type == 'throbber') {
    this.progress.element = $('<div class="ajax-progress ajax-progress-throbber"><i class="glyphicon glyphicon-refresh glyphicon-spin"></i></div>');
    if (this.progress.message) {
      $('.throbber', this.progress.element).after('<div class="message">' + this.progress.message + '</div>');
    }

    // If element is an input type, append after.
    if ($element.is('input')) {
      $element.after(this.progress.element);
    }
    else if ($element.is('select')) {
      var $inputGroup = $element.closest('.form-item').find('.input-group-addon, .input-group-btn');
      if (!$inputGroup.length) {
        $element.wrap('<div class="input-group">');
        $inputGroup = $('<span class="input-group-addon">');
        $element.after($inputGroup);
      }
      $inputGroup.append(this.progress.element);
    }
    // Otherwise append the throbber inside the element.
    else {
      $element.append(this.progress.element);
    }
  }
};

})(jQuery);
;
