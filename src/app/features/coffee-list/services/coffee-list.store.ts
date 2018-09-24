import {Injectable, OnDestroy} from '@angular/core';
import {Store} from 'rxjs-observable-store';
import {Subject, Observable} from 'rxjs';
import {takeUntil, tap, switchMap, retry} from 'rxjs/operators';

import {CoffeeListStoreState} from './coffee-list.store.state';
import {CoffeeListEndpoint} from './coffee-list.endpoint';
import {ModalComponent} from '../../../shared/components/modal/modal.component';
import {Candidate} from '../types/candidate';
import * as candidateHelpers from '../helpers/candidate.helpers';
import {UserStore} from '../../../core/user/services/user.store';
import {User} from '../../../core/user/types/user';
import {USER_ACTION} from '../coffee-list.constants';

@Injectable()
export class CoffeeListStore extends Store<CoffeeListStoreState> implements OnDestroy {
    private ngUnsubscribe$: Subject<undefined> = new Subject();
    private reloadCandidates$: Subject<undefined> = new Subject();
    private detailsModal: ModalComponent;

    constructor(private endpoint: CoffeeListEndpoint, private userStore: UserStore) {
        super(new CoffeeListStoreState());
    }

    init(): void {
        this.initReloadCandidates$();
        this.subscribeToUserUpdates();

        this.reloadCandidates();
    }

    setDetailsModal(detailsModal: ModalComponent): void {
        this.detailsModal = detailsModal;
    }

    ngOnDestroy(): void {
        this.ngUnsubscribe$.next();
        this.ngUnsubscribe$.complete();
    }

    reloadCandidates(): void {
        this.reloadCandidates$.next();
    }

    openDetailsModal(candidate: Candidate): void {
        this.setDetailsModalState(candidate);
        this.detailsModal.open();
    }

    closeDetailsModal(): void {
        this.setDetailsModalState(null);
        this.detailsModal.close();
    }

    setDetailsModalState(candidate: Candidate): void {
        this.setState({
            ...this.state,
            detailsModal: {
                candidate: candidate,
            },
        });
    }

    submitUserAction(candidate: Candidate, action: string): void {
        let request$: Observable<null>;

        if (action === USER_ACTION.addVote) {
            request$ = this.endpoint.addVote(this, candidate);
        }
        if (action === USER_ACTION.removeVote) {
            request$ = this.endpoint.removeVote(this, candidate);
        }
        request$
            .pipe(
                tap(() => {
                    this.reloadCandidates();
                })
            )
            .subscribe();
    }

    private initReloadCandidates$(): void {
        this.reloadCandidates$
            .pipe(
                switchMap(() => {
                    return this.endpoint.listCandidates(
                        this,
                    );
                }),
                tap(candidates => {
                    this.updateCandidatesState(candidates, this.userStore.user);
                }),
                retry(),
                takeUntil(this.ngUnsubscribe$)
            )
            .subscribe();
    }

    private subscribeToUserUpdates(): void {
        this.userStore.user$
            .pipe(takeUntil(this.ngUnsubscribe$))
            .subscribe(user => {
                this.updateCandidatesState(this.state.candidates, user);
            });
    }

    private updateCandidatesState(candidates: Candidate[], user: User): void {
        this.setState({
            ...this.state,
            candidates: candidateHelpers.getCandidatesInStoreFormat(candidates, user),
        });
    }
}