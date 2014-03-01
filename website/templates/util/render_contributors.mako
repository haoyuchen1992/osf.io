% for contributor in contributors:
    <span data-pk="${contributor['id']}"
        class="contributor ${'contributor-registered' if contributor['registered'] else 'contributor-unregistered'}">
        % if contributor['registered']:
            <a href="/${contributor['id']}/"
                % if 'admin' in user['permissions']:
                    class="user-quickedit"
                    data-userid="${contributor['id']}" data-fullname="${contributor['fullname']}"
                % endif
                >${contributor['fullname']}</a>
        % else:
            <span
                % if 'admin' in user['permissions']:
                    class="user-quickedit"
                    data-userid="${contributor['id']}" data-fullname="${contributor['fullname']}"
                % endif
                >${contributor['fullname']}</span>
        % endif
    </span>
    ${', ' if not loop.last else ''}
% endfor

% if 'admin' in user['permissions']:
    | <a href="#addContributors" data-toggle="modal">add</a>
##    | <a href="${node['url']}contributors/">manage</a>
% endif
